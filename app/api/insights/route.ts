import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveMeralcoRates,
  computeMeralcoBill,
} from "@/lib/meralco-rates";
import { InsightType } from "@/lib/constants";
import {
  createEmptyStructuredInsights,
  parseStructuredInsightsJson,
  parseStructuredInsightsPayload,
  type StructuredInsightsPayload,
} from "@/lib/insights";

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
};

type EnergyLogRow = {
  device_id: string;
  energy_kwh: string | number;
  recorded_at: string;
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

function computeUsage(logs: EnergyLogRow[] | null): UsageResult {
  if (!logs?.length) {
    return { totalKwh: 0, byDevice: new Map() };
  }

  const byDevice = new Map<string, number[]>();

  for (const log of logs) {
    const kwh = Number(log.energy_kwh);
    if (!Number.isFinite(kwh) || kwh < 0) {
      continue;
    }

    const readings = byDevice.get(log.device_id) ?? [];
    readings.push(kwh);
    byDevice.set(log.device_id, readings);
  }

  const usageByDevice = new Map<string, number>();
  let totalKwh = 0;

  for (const [deviceId, readings] of byDevice) {
    if (readings.length < 2) {
      usageByDevice.set(deviceId, 0);
      continue;
    }

    const usage = Math.max(0, Math.max(...readings) - Math.min(...readings));
    usageByDevice.set(deviceId, usage);
    totalKwh += usage;
  }

  return { totalKwh, byDevice: usageByDevice };
}

function buildEmptyResponse(insightType: InsightType, cached: boolean) {
  return {
    ...createEmptyStructuredInsights(),
    insight_type: insightType,
    cached,
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
  monthCostPhp: number;
  projectedMonthly: number;
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
    monthCostPhp,
    projectedMonthly,
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
        projectedMonthly >= monthlyBudget ||
        (daysElapsed >= 10 && monthCostPhp >= monthlyBudget * 0.8);

      return {
        ...empty,
        budget: isAtRisk
          ? {
              is_at_risk: true,
              message: topDevice
                ? `Naku boss, projected ka sa ₱${projectedMonthly.toFixed(2)} laban sa ₱${monthlyBudget.toFixed(2)} budget mo. Bantayan lalo si ${topDevice.name} kasi siya ang pinakamabigat ngayon at nasa ₱${topDevice.cost.toFixed(2)} na ang ambag niya.`
                : `Naku boss, projected ka sa ₱${projectedMonthly.toFixed(2)} laban sa ₱${monthlyBudget.toFixed(2)} budget mo. Medyo bawasan muna ang high-watt appliance hours para di tayo lumampas.`,
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
  monthCostPhp: number;
  projectedMonthly: number;
  daysElapsed: number;
  devices: DeviceRow[];
  thisWeek: UsageResult;
  lastWeek: UsageResult;
  thisWeekCost: number;
  lastWeekCost: number;
  topDevices: TopDevice[];
}): string {
  const {
    insightType,
    monthlyBudget,
    monthCostPhp,
    projectedMonthly,
    daysElapsed,
    devices,
    thisWeek,
    lastWeek,
    thisWeekCost,
    lastWeekCost,
    topDevices,
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
      current_month_spend_php: Number(monthCostPhp.toFixed(2)),
      projected_monthly_php: Number(projectedMonthly.toFixed(2)),
      days_elapsed: daysElapsed,
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

    const cachedPayload = parseStructuredInsightsJson(cached?.message);
    if (cachedPayload) {
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("monthly_budget_php")
      .eq("id", user.id)
      .maybeSingle();

    const monthlyBudget = Number(profile?.monthly_budget_php ?? 2000);

    const { data: devices } = await supabase
      .from("devices")
      .select("id, device_name, mac_address, appliance_type")
      .eq("user_id", user.id)
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

    const deviceIds = devices.flatMap((device) =>
      [device.id, device.mac_address].filter(Boolean)
    );

    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - 7);
    const lastWeekStart = new Date(now);
    lastWeekStart.setDate(now.getDate() - 14);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [thisWeekLogsRes, lastWeekLogsRes, monthLogsRes] = await Promise.all([
      supabase
        .from("energy_logs")
        .select("device_id, energy_kwh, recorded_at")
        .in("device_id", deviceIds)
        .gte("recorded_at", thisWeekStart.toISOString())
        .order("recorded_at", { ascending: true })
        .limit(5000),
      supabase
        .from("energy_logs")
        .select("device_id, energy_kwh, recorded_at")
        .in("device_id", deviceIds)
        .gte("recorded_at", lastWeekStart.toISOString())
        .lt("recorded_at", thisWeekStart.toISOString())
        .order("recorded_at", { ascending: true })
        .limit(5000),
      supabase
        .from("energy_logs")
        .select("device_id, energy_kwh, recorded_at")
        .in("device_id", deviceIds)
        .gte("recorded_at", monthStart.toISOString())
        .order("recorded_at", { ascending: true })
        .limit(5000),
    ]);

    const thisWeek = computeUsage((thisWeekLogsRes.data ?? []) as EnergyLogRow[]);
    const lastWeek = computeUsage((lastWeekLogsRes.data ?? []) as EnergyLogRow[]);
    const monthUsage = computeUsage((monthLogsRes.data ?? []) as EnergyLogRow[]);

    const monthCostPhp = computeMeralcoBill(
      monthUsage.totalKwh,
      meralcoData.rates,
      meralcoData.vatRate,
      { fixedChargesPhp: meralcoData.fixedMonthlyChargesPhp }
    );

    const daysElapsed = Math.max(1, now.getDate());
    const projectedMonthly = (monthCostPhp / daysElapsed) * 30;

    const deviceNameMap = new Map<string, string>();
    for (const device of devices) {
      deviceNameMap.set(device.id, device.device_name);
      if (device.mac_address) {
        deviceNameMap.set(device.mac_address, device.device_name);
      }
    }

    const topDevices = Array.from(monthUsage.byDevice.entries())
      .map(([deviceId, kwh]) => ({
        name: deviceNameMap.get(deviceId) ?? deviceId,
        kwh,
        cost: computeMeralcoBill(kwh, meralcoData.rates, meralcoData.vatRate),
      }))
      .sort((first, second) => second.cost - first.cost)
      .slice(0, 3);

    const thisWeekCost = computeMeralcoBill(
      thisWeek.totalKwh,
      meralcoData.rates,
      meralcoData.vatRate
    );
    const lastWeekCost = computeMeralcoBill(
      lastWeek.totalKwh,
      meralcoData.rates,
      meralcoData.vatRate
    );

    const fallbackPayload = buildFallbackInsights({
      insightType: typedInsightType,
      monthlyBudget,
      monthCostPhp,
      projectedMonthly,
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
            monthCostPhp,
            projectedMonthly,
            daysElapsed,
            devices: devices as DeviceRow[],
            thisWeek,
            lastWeek,
            thisWeekCost,
            lastWeekCost,
            topDevices,
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
      message: JSON.stringify(normalizedPayload),
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
