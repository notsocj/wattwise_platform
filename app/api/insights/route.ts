import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveMeralcoRates,
  computeHistoricalVariableSpendByDeviceFromDayRows,
  computeHistoricalVariableSpendFromDayRows,
  getMeralcoRatesForRange,
} from "@/lib/meralco-rates";
import { InsightType } from "@/lib/constants";
import {
  createEmptyStructuredInsights,
  parseStructuredInsightsJson,
  parseStructuredInsightsPayload,
  type StructuredInsightsPayload,
} from "@/lib/insights";
import {
  getCurrentBillingCycle,
  getEndOfManilaDay,
  getManilaDayKey,
  getStartOfManilaDay,
} from "@/lib/date-utils";

const VALID_INSIGHT_TYPES = Object.values(InsightType);

const CACHE_WINDOW_DAYS: Record<InsightType, number> = {
  [InsightType.BudgetAlert]: 1,
  [InsightType.WeeklyRecap]: 7,
  [InsightType.AnomalyAlert]: 1,
  [InsightType.CostOptimizer]: 7,
};

const SYSTEM_PROMPT = `You are a friendly Filipino financial and energy advisor called "WattWise Tipid Advisor".
Language: Casual conversational Taglish (Tagalog-English mix).
Tone: Encouraging, practical, and hyper-specific to the user's data.
Always reference exact PHP amounts, appliance names, and timeframes. Never give generic advice.
Keep responses concise (2-4 sentences max). Use peso sign ₱ for amounts.
Respond strictly as raw JSON with this schema:
{
  "anomaly": {
    "is_detected": boolean,
    "message": string
  },
  "budget": {
    "is_at_risk": boolean,
    "message": string
  },
  "tipid_tip": {
    "has_tip": boolean,
    "message": string
  },
  "weekly_recap": {
    "has_recap": boolean,
    "message": string
  }
}
You must ONLY set "is_detected", "is_at_risk", or "has_tip" to true if there is a legitimate, actionable issue. If the data is normal, benign, or expected, you MUST set the boolean to false and leave the message empty. Do NOT write "everything is normal".
If a boolean is false, its matching message must be an empty string.
Only the object relevant to the requested insight_type may be populated. All unrelated objects must remain false with empty messages.
Do not include markdown, code fences, prose outside JSON, or extra keys.`;

type DeviceRow = {
  id: string;
  device_name: string;
  mac_address: string;
  appliance_type: string | null;
  owner_id: string | null;
  tenant_id: string | null;
  user_approved_limit_php: number | string | null;
};

type ProfileRow = {
  monthly_budget_php: number | string | null;
  billing_cycle_start_day: number | null;
  role: string | null;
};

type UsageByDeviceDayRow = {
  device_id: string;
  day_key: string;
  usage_kwh: string | number;
};

type UsageResult = {
  totalKwh: number;
  byDevice: Map<string, number>;
};

type TopDevice = {
  name: string;
  kwh: number;
  cost: number;
};

type CachedInsightMetadata = {
  billing_cycle_start_day: number;
  cycle_start_date: string;
  cycle_end_date: string;
};

function parseJsonObject(content: string | null | undefined): unknown {
  if (!content) {
    return null;
  }

  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function computeUsage(rows: UsageByDeviceDayRow[] | null): UsageResult {
  if (!rows?.length) {
    return { totalKwh: 0, byDevice: new Map() };
  }

  const byDevice = new Map<string, number>();

  for (const row of rows) {
    const kwh = Number(row.usage_kwh);
    if (!Number.isFinite(kwh) || kwh < 0) {
      continue;
    }

    byDevice.set(row.device_id, (byDevice.get(row.device_id) ?? 0) + kwh);
  }

  let totalKwh = 0;

  for (const usage of byDevice.values()) {
    totalKwh += usage;
  }

  return { totalKwh, byDevice };
}

function buildEmptyResponse(insightType: InsightType, cached: boolean) {
  return {
    ...createEmptyStructuredInsights(),
    insight_type: insightType,
    cached,
  };
}

function parseCachedInsightMetadata(value: unknown): CachedInsightMetadata | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const billingCycleStartDay = payload.billing_cycle_start_day;
  const cycleStartDate = payload.cycle_start_date;
  const cycleEndDate = payload.cycle_end_date;

  if (
    !Number.isInteger(billingCycleStartDay) ||
    typeof cycleStartDate !== "string" ||
    typeof cycleEndDate !== "string"
  ) {
    return null;
  }

  return {
    billing_cycle_start_day: Number(billingCycleStartDay),
    cycle_start_date: cycleStartDate,
    cycle_end_date: cycleEndDate,
  };
}

function sanitizeRequestedPayload(
  insightType: InsightType,
  payload: StructuredInsightsPayload,
  fallback: StructuredInsightsPayload
): StructuredInsightsPayload {
  const empty = createEmptyStructuredInsights();

  switch (insightType) {
    case InsightType.BudgetAlert: {
      const budget =
        payload.budget.is_at_risk && payload.budget.message
          ? payload.budget
          : fallback.budget;

      return {
        ...empty,
        budget: budget.is_at_risk
          ? budget
          : { is_at_risk: false, message: "" },
      };
    }
    case InsightType.AnomalyAlert: {
      const anomaly =
        payload.anomaly.is_detected && payload.anomaly.message
          ? payload.anomaly
          : fallback.anomaly;

      return {
        ...empty,
        anomaly: anomaly.is_detected
          ? anomaly
          : { is_detected: false, message: "" },
      };
    }
    case InsightType.CostOptimizer: {
      const tipidTip =
        payload.tipid_tip.has_tip && payload.tipid_tip.message
          ? payload.tipid_tip
          : fallback.tipid_tip;

      return {
        ...empty,
        tipid_tip: tipidTip.has_tip
          ? tipidTip
          : { has_tip: false, message: "" },
      };
    }
    case InsightType.WeeklyRecap: {
      const weeklyRecap =
        payload.weekly_recap.has_recap && payload.weekly_recap.message
          ? payload.weekly_recap
          : fallback.weekly_recap;

      return {
        ...empty,
        weekly_recap: weeklyRecap.has_recap
          ? weeklyRecap
          : { has_recap: false, message: "" },
      };
    }
    default:
      return empty;
  }
}

function buildFallbackInsights(params: {
  insightType: InsightType;
  monthlyBudget: number;
  cycleCostPhp: number;
  projectedCycleBill: number;
  daysElapsed: number;
  thisWeek: UsageResult;
  lastWeek: UsageResult;
  thisWeekCost: number;
  lastWeekCost: number;
  topDevices: TopDevice[];
  deviceCount: number;
}): StructuredInsightsPayload {
  const {
    insightType,
    monthlyBudget,
    cycleCostPhp,
    projectedCycleBill,
    daysElapsed,
    thisWeek,
    lastWeek,
    thisWeekCost,
    lastWeekCost,
    topDevices,
    deviceCount,
  } = params;

  const empty = createEmptyStructuredInsights();
  const topDevice = topDevices[0] ?? null;
  const topDeviceShare = topDevice && thisWeek.totalKwh > 0
    ? topDevice.kwh / thisWeek.totalKwh
    : 0;
  const weekJumpRatio =
    lastWeek.totalKwh > 0 ? thisWeek.totalKwh / lastWeek.totalKwh : 1;

  switch (insightType) {
    case InsightType.BudgetAlert: {
      const isAtRisk =
        projectedCycleBill >= monthlyBudget ||
        (daysElapsed >= 10 && cycleCostPhp >= monthlyBudget * 0.8);

      return {
        ...empty,
        budget: isAtRisk
          ? {
              is_at_risk: true,
              message: topDevice
                ? `Naku boss, projected ka sa ₱${projectedCycleBill.toFixed(2)} laban sa ₱${monthlyBudget.toFixed(2)} budget mo this billing cycle. Bantayan lalo si ${topDevice.name} kasi siya ang pinakamabigat ngayon at nasa ₱${topDevice.cost.toFixed(2)} na ang ambag niya.`
                : `Naku boss, projected ka sa ₱${projectedCycleBill.toFixed(2)} laban sa ₱${monthlyBudget.toFixed(2)} budget mo this billing cycle. Medyo bawasan muna ang high-watt appliance hours para di tayo lumampas.`,
            }
          : { is_at_risk: false, message: "" },
      };
    }
    case InsightType.AnomalyAlert: {
      const isDetected =
        (lastWeek.totalKwh > 0 &&
          weekJumpRatio >= 1.4 &&
          thisWeek.totalKwh - lastWeek.totalKwh >= 0.5) ||
        (topDevice !== null && topDeviceShare >= 0.7 && topDevice.cost >= 50 && deviceCount > 1);

      return {
        ...empty,
        anomaly: isDetected
          ? {
              is_detected: true,
              message: topDevice && topDeviceShare >= 0.7
                ? `${topDevice.name} ang nangingibabaw sa usage mo ngayon, nasa ${(
                    topDeviceShare * 100
                  ).toFixed(0)}% ng weekly consumption. Sulit i-check kung may naiwan na bukas o mas mahaba ang takbo kaysa normal.`
                : `May unusual jump sa weekly usage mo: ${thisWeek.totalKwh.toFixed(2)} kWh this week kumpara sa ${lastWeek.totalKwh.toFixed(2)} kWh last week. I-check muna kung aling appliance ang mas tumagal ang gamit nitong mga huling araw.`,
            }
          : { is_detected: false, message: "" },
      };
    }
    case InsightType.CostOptimizer: {
      const hasTip = topDevice !== null && topDevice.cost >= 10;
      const estimatedSavings = topDevice ? Math.max(topDevice.cost * 0.12, 5) : 0;

      return {
        ...empty,
        tipid_tip: hasTip
          ? {
              has_tip: true,
              message: `Tipid move: unahin mong bawasan ang runtime ni ${topDevice.name} this week. Kung mababawasan mo kahit kaunti ang paggamit nito, puwedeng makatipid ng mga ₱${estimatedSavings.toFixed(2)} base sa current trend.`,
            }
          : { has_tip: false, message: "" },
      };
    }
    case InsightType.WeeklyRecap: {
      const hasRecap = thisWeek.totalKwh > 0 || lastWeek.totalKwh > 0;
      const deltaPercent =
        lastWeek.totalKwh > 0
          ? ((thisWeek.totalKwh - lastWeek.totalKwh) / lastWeek.totalKwh) * 100
          : 0;

      return {
        ...empty,
        weekly_recap: hasRecap
          ? {
              has_recap: true,
              message:
                deltaPercent <= 0
                  ? `Bida ka boss, nasa ${thisWeek.totalKwh.toFixed(2)} kWh (₱${thisWeekCost.toFixed(2)}) ka this week kumpara sa ${lastWeek.totalKwh.toFixed(2)} kWh (₱${lastWeekCost.toFixed(2)}) last week.`
                  : `This week nasa ${thisWeek.totalKwh.toFixed(2)} kWh (₱${thisWeekCost.toFixed(2)}) ka versus ${lastWeek.totalKwh.toFixed(2)} kWh (₱${lastWeekCost.toFixed(2)}) last week, so may room pa para humabol sa tipid.`,
            }
          : { has_recap: false, message: "" },
      };
    }
    default:
      return empty;
  }
}

function buildUserPrompt(params: {
  insightType: InsightType;
  monthlyBudget: number;
  cycleCostPhp: number;
  projectedCycleBill: number;
  daysElapsed: number;
  cycleStartDate: string;
  cycleEndDate: string;
  billingCycleStartDay: number;
  devices: DeviceRow[];
  thisWeek: UsageResult;
  lastWeek: UsageResult;
  thisWeekCost: number;
  lastWeekCost: number;
  topDevices: TopDevice[];
  viewerRole: string;
  tenantHardLimitPhp: number | null;
}): string {
  const {
    insightType,
    monthlyBudget,
    cycleCostPhp,
    projectedCycleBill,
    daysElapsed,
    cycleStartDate,
    cycleEndDate,
    billingCycleStartDay,
    devices,
    thisWeek,
    lastWeek,
    thisWeekCost,
    lastWeekCost,
    topDevices,
    viewerRole,
    tenantHardLimitPhp,
  } = params;

  const topDevicesStr =
    topDevices
      .map((device) => `${device.name}: ${device.kwh.toFixed(2)} kWh (₱${device.cost.toFixed(2)})`)
      .join(", ") || "none";

  return JSON.stringify({
    insight_type: insightType,
    instruction:
      "Populate only the object that matches insight_type. All other objects must have false booleans and empty messages.",
    data: {
      monthly_budget_php: Number(monthlyBudget.toFixed(2)),
      viewer_role: viewerRole,
      tenant_hard_limit_php:
        tenantHardLimitPhp === null ? null : Number(tenantHardLimitPhp.toFixed(2)),
      advice_tone:
        viewerRole === "tenant"
          ? "Tenant view: explain the landlord-imposed hard limit in casual Taglish and warn before auto-off."
          : viewerRole === "manager"
            ? "Manager view: frame advice around room/fleet management and tenant sub-meter limits."
            : "Homeowner view: use normal practical Taglish energy coaching.",
      current_billing_cycle_spend_php: Number(cycleCostPhp.toFixed(2)),
      projected_billing_cycle_php: Number(projectedCycleBill.toFixed(2)),
      days_elapsed_in_cycle: daysElapsed,
      billing_cycle_start_day: billingCycleStartDay,
      cycle_start_date: cycleStartDate,
      cycle_end_date: cycleEndDate,
      this_week_kwh: Number(thisWeek.totalKwh.toFixed(2)),
      this_week_php: Number(thisWeekCost.toFixed(2)),
      last_week_kwh: Number(lastWeek.totalKwh.toFixed(2)),
      last_week_php: Number(lastWeekCost.toFixed(2)),
      device_count: devices.length,
      device_names: devices.map((device) => device.device_name),
      top_devices: topDevicesStr,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const insightType = body.insight_type as string;

    if (
      !insightType ||
      !VALID_INSIGHT_TYPES.includes(insightType as InsightType)
    ) {
      return NextResponse.json(
        {
          error: `Invalid insight_type. Must be one of: ${VALID_INSIGHT_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const typedInsightType = insightType as InsightType;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("monthly_budget_php, billing_cycle_start_day, role")
      .eq("id", user.id)
      .maybeSingle<ProfileRow>();

    const viewerRole = profile?.role ?? "user";
    let monthlyBudget = Number(profile?.monthly_budget_php ?? 2000);
    let billingCycleStartDay = profile?.billing_cycle_start_day ?? 1;
    const now = new Date();
    let tenantHardLimitPhp: number | null = null;

    if (viewerRole === "tenant") {
      const { data: assignedDevices } = await supabase
        .from("devices")
        .select("owner_id, user_approved_limit_php")
        .eq("tenant_id", user.id);
      const hardLimit = (assignedDevices ?? []).reduce(
        (sum, device) => sum + Number(device.user_approved_limit_php ?? 0),
        0
      );
      const ownerId = assignedDevices?.find((device) => device.owner_id)?.owner_id;

      if (hardLimit > 0) {
        tenantHardLimitPhp = hardLimit;
        monthlyBudget = hardLimit;
      }

      if (ownerId) {
        const { data: ownerProfile } = await supabase
          .from("profiles")
          .select("billing_cycle_start_day")
          .eq("id", ownerId)
          .maybeSingle<{ billing_cycle_start_day: number | null }>();
        billingCycleStartDay = ownerProfile?.billing_cycle_start_day ?? billingCycleStartDay;
      }
    }

    const billingCycle = getCurrentBillingCycle(billingCycleStartDay, now);
    const cycleStartDate = getManilaDayKey(billingCycle.startDate);
    const cycleEndDate = getManilaDayKey(billingCycle.endDate);

    const cacheDays = CACHE_WINDOW_DAYS[typedInsightType];
    const cacheStart = new Date();
    cacheStart.setDate(cacheStart.getDate() - cacheDays);

    const { data: cached } = await supabase
      .from("ai_insights")
      .select("message")
      .eq("user_id", user.id)
      .eq("insight_type", typedInsightType)
      .gte("created_at", cacheStart.toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const cachedRaw = parseJsonObject(cached?.message);
    const cachedPayload = parseStructuredInsightsJson(cached?.message);
    const cachedMetadata = parseCachedInsightMetadata(cachedRaw);
    const canUseCachedPayload =
      cachedPayload &&
      cachedMetadata &&
      cachedMetadata.billing_cycle_start_day === billingCycleStartDay &&
      cachedMetadata.cycle_start_date === cycleStartDate &&
      cachedMetadata.cycle_end_date === cycleEndDate;

    if (canUseCachedPayload) {
      return NextResponse.json({
        ...cachedPayload,
        insight_type: typedInsightType,
        cached: true,
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const { data: devices } = await supabase
      .from("devices")
      .select("id, device_name, mac_address, appliance_type, owner_id, tenant_id, user_approved_limit_php")
      .or(
        viewerRole === "tenant"
          ? `tenant_id.eq.${user.id}`
          : `owner_id.eq.${user.id},user_id.eq.${user.id}`
      )
      .limit(50);

    if (!devices?.length) {
      return NextResponse.json(buildEmptyResponse(typedInsightType, false));
    }

    let meralcoData;
    try {
      meralcoData = await getActiveMeralcoRates(supabase);
    } catch {
      return NextResponse.json(
        { error: "No active Meralco rates found. Please contact admin." },
        { status: 500 }
      );
    }

    const startOfToday = getStartOfManilaDay(now);
    const endOfToday = getEndOfManilaDay(now);
    const thisWeekStart = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
    const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastWeekEnd = new Date(thisWeekStart.getTime() - 1);
    const rateRangeStart =
      billingCycle.startDate.getTime() < lastWeekStart.getTime()
        ? billingCycle.startDate
        : lastWeekStart;

    const [rateRows, thisWeekUsageRes, lastWeekUsageRes, cycleUsageRes] = await Promise.all([
      getMeralcoRatesForRange(supabase, rateRangeStart, now),
      supabase.rpc("get_usage_kwh_by_device_day", {
        p_user_id: user.id,
        p_start: thisWeekStart.toISOString(),
        p_end: endOfToday.toISOString(),
      }),
      supabase.rpc("get_usage_kwh_by_device_day", {
        p_user_id: user.id,
        p_start: lastWeekStart.toISOString(),
        p_end: lastWeekEnd.toISOString(),
      }),
      supabase.rpc("get_usage_kwh_by_device_day", {
        p_user_id: user.id,
        p_start: billingCycle.startDate.toISOString(),
        p_end: now.toISOString(),
      }),
    ]);

    const thisWeekRows = (thisWeekUsageRes.data ?? []) as UsageByDeviceDayRow[];
    const lastWeekRows = (lastWeekUsageRes.data ?? []) as UsageByDeviceDayRow[];
    const cycleRows = (cycleUsageRes.data ?? []) as UsageByDeviceDayRow[];
    const thisWeek = computeUsage(thisWeekRows);
    const lastWeek = computeUsage(lastWeekRows);
    const cycleUsage = computeUsage(cycleRows);
    const cycleVariableSpendPhp = computeHistoricalVariableSpendFromDayRows(
      cycleRows,
      rateRows
    );
    const cycleCostPhp =
      cycleVariableSpendPhp +
      meralcoData.fixedMonthlyChargesPhp * (1 + meralcoData.vatRate);
    const projectedVariableSpend =
      billingCycle.elapsedDays > 0
        ? (cycleVariableSpendPhp / billingCycle.elapsedDays) * billingCycle.totalDays
        : 0;
    const projectedCycleBill =
      projectedVariableSpend +
      meralcoData.fixedMonthlyChargesPhp * (1 + meralcoData.vatRate);
    const daysElapsed = billingCycle.elapsedDays;

    const deviceNameMap = new Map<string, string>();
    for (const device of devices) {
      deviceNameMap.set(device.id, device.device_name);
      if (device.mac_address) {
        deviceNameMap.set(device.mac_address, device.device_name);
      }
    }

    const variableSpendByDevice = computeHistoricalVariableSpendByDeviceFromDayRows(
      cycleRows,
      rateRows
    );
    const topDevices = Array.from(cycleUsage.byDevice.entries())
      .map(([deviceId, kwh]) => ({
        name: deviceNameMap.get(deviceId) ?? deviceId,
        kwh,
        cost: variableSpendByDevice.get(deviceId) ?? 0,
      }))
      .sort((first, second) => second.cost - first.cost)
      .slice(0, 3);

    const thisWeekCost = computeHistoricalVariableSpendFromDayRows(
      thisWeekRows,
      rateRows
    );
    const lastWeekCost = computeHistoricalVariableSpendFromDayRows(
      lastWeekRows,
      rateRows
    );

    const fallbackPayload = buildFallbackInsights({
      insightType: typedInsightType,
      monthlyBudget,
      cycleCostPhp,
      projectedCycleBill,
      daysElapsed,
      thisWeek,
      lastWeek,
      thisWeekCost,
      lastWeekCost,
      topDevices,
      deviceCount: devices.length,
    });

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 260,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: buildUserPrompt({
            insightType: typedInsightType,
            monthlyBudget,
            cycleCostPhp,
            projectedCycleBill,
            daysElapsed,
            cycleStartDate,
            cycleEndDate,
            billingCycleStartDay,
            devices: devices as DeviceRow[],
            thisWeek,
            lastWeek,
            thisWeekCost,
            lastWeekCost,
            topDevices,
            viewerRole,
            tenantHardLimitPhp,
          }),
        },
      ],
    });

    const aiPayload = parseStructuredInsightsPayload(
      parseJsonObject(completion.choices[0]?.message?.content)
    );
    const normalizedPayload = sanitizeRequestedPayload(
      typedInsightType,
      aiPayload ?? createEmptyStructuredInsights(),
      fallbackPayload
    );

    const promptTokens = completion.usage?.prompt_tokens ?? 0;
    const completionTokens = completion.usage?.completion_tokens ?? 0;

    await supabase.from("ai_insights").insert({
      user_id: user.id,
      insight_type: typedInsightType,
      message: JSON.stringify({
        ...normalizedPayload,
        billing_cycle_start_day: billingCycleStartDay,
        cycle_start_date: cycleStartDate,
        cycle_end_date: cycleEndDate,
      }),
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
    });

    return NextResponse.json({
      ...normalizedPayload,
      insight_type: typedInsightType,
      cached: false,
    });
  } catch (err) {
    console.error("Insights API error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to generate insight",
      },
      { status: 500 }
    );
  }
}
