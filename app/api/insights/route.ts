import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { OPENAI_CHAT_MODEL } from "@/lib/openai";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveMeralcoRates,
  computeHistoricalVariableSpendByDeviceFromDayRows,
  computeHistoricalVariableSpendFromDayRows,
  getMeralcoRatesForRange,
  computeFixedChargesWithVat,
} from "@/lib/meralco-rates";
import { InsightType } from "@/lib/constants";
import {
  createEmptyStructuredInsights,
  parseStructuredInsightsJson,
  parseStructuredInsightsPayload,
} from "@/lib/insights";
import {
  buildFallbackInsights,
  buildUserPrompt,
  computeUsage,
  parseCachedInsightMetadata,
  sanitizeRequestedPayload,
  type DeviceRow,
  type UsageByDeviceDayRow,
} from "@/lib/insights-server";
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

type ProfileRow = {
  monthly_budget_php: number | string | null;
  billing_cycle_start_day: number | null;
  role: string | null;
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

function buildEmptyResponse(insightType: InsightType, cached: boolean) {
  return {
    ...createEmptyStructuredInsights(),
    insight_type: insightType,
    cached,
  };
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
      computeFixedChargesWithVat(meralcoData.fixedMonthlyChargesPhp, meralcoData.vatRate);
    const projectedVariableSpend =
      billingCycle.elapsedDays > 0
        ? (cycleVariableSpendPhp / billingCycle.elapsedDays) * billingCycle.totalDays
        : 0;
    const projectedCycleBill =
      projectedVariableSpend +
      computeFixedChargesWithVat(meralcoData.fixedMonthlyChargesPhp, meralcoData.vatRate);
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
      model: OPENAI_CHAT_MODEL,
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
