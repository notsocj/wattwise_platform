import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveMeralcoRates,
  computeMeralcoBill,
} from "@/lib/meralco-rates";

const VALID_INSIGHT_TYPES = [
  "budget_alert",
  "weekly_recap",
  "anomaly_alert",
  "cost_optimizer",
] as const;

type InsightType = (typeof VALID_INSIGHT_TYPES)[number];

const CACHE_WINDOW_DAYS: Record<InsightType, number> = {
  budget_alert: 1,
  weekly_recap: 7,
  anomaly_alert: 1,
  cost_optimizer: 7,
};

const SYSTEM_PROMPT = `You are a friendly Filipino financial and energy advisor called "WattWise Tipid Advisor".
Language: Casual conversational Taglish (Tagalog-English mix).
Tone: Encouraging, practical, and hyper-specific to the user's data.
Always reference exact PHP amounts, appliance names, and timeframes. Never give generic advice.
Keep responses concise (2-4 sentences max). Use peso sign ₱ for amounts.`;

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

    // --- Cache check ---
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

    if (cached?.message) {
      return NextResponse.json({
        message: cached.message,
        insight_type: typedInsightType,
        cached: true,
      });
    }

    // --- Aggregate user data ---
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("monthly_budget_php, full_name")
      .eq("id", user.id)
      .maybeSingle();

    const monthlyBudget = Number(profile?.monthly_budget_php ?? 2000);

    // Get user devices
    const { data: devices } = await supabase
      .from("devices")
      .select("id, device_name, mac_address, appliance_type")
      .eq("user_id", user.id)
      .limit(50);

    if (!devices?.length) {
      return NextResponse.json({
        message:
          "Wala ka pang naka-pair na appliance, boss! Mag-add muna sa Dashboard para ma-track natin yung usage mo.",
        insight_type: typedInsightType,
        cached: false,
      });
    }

    // Get active Meralco rates
    let meralcoData;
    try {
      meralcoData = await getActiveMeralcoRates(supabase);
    } catch {
      return NextResponse.json(
        { error: "No active Meralco rates found. Please contact admin." },
        { status: 500 }
      );
    }

    // Build device ID lookup set (both UUID and MAC)
    const deviceIds = devices.flatMap((d) =>
      [d.id, d.mac_address].filter(Boolean)
    );

    // Fetch energy logs for relevant periods
    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - 7);
    const lastWeekStart = new Date(now);
    lastWeekStart.setDate(now.getDate() - 14);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data: thisWeekLogs } = await supabase
      .from("energy_logs")
      .select("device_id, energy_kwh, recorded_at")
      .in("device_id", deviceIds)
      .gte("recorded_at", thisWeekStart.toISOString())
      .order("recorded_at", { ascending: true })
      .limit(5000);

    const { data: lastWeekLogs } = await supabase
      .from("energy_logs")
      .select("device_id, energy_kwh, recorded_at")
      .in("device_id", deviceIds)
      .gte("recorded_at", lastWeekStart.toISOString())
      .lt("recorded_at", thisWeekStart.toISOString())
      .order("recorded_at", { ascending: true })
      .limit(5000);

    const { data: monthLogs } = await supabase
      .from("energy_logs")
      .select("device_id, energy_kwh, recorded_at")
      .in("device_id", deviceIds)
      .gte("recorded_at", monthStart.toISOString())
      .order("recorded_at", { ascending: true })
      .limit(5000);

    // Compute usage per device (sequential deltas using min/max per bucket)
    function computeUsage(
      logs: Array<{
        device_id: string;
        energy_kwh: string | number;
        recorded_at: string;
      }> | null
    ): { totalKwh: number; byDevice: Map<string, number> } {
      if (!logs?.length) return { totalKwh: 0, byDevice: new Map() };

      const byDevice = new Map<string, number[]>();
      for (const log of logs) {
        const kwh = Number(log.energy_kwh);
        if (!Number.isFinite(kwh) || kwh < 0) continue;
        const arr = byDevice.get(log.device_id) ?? [];
        arr.push(kwh);
        byDevice.set(log.device_id, arr);
      }

      const usageByDevice = new Map<string, number>();
      let totalKwh = 0;
      for (const [deviceId, readings] of byDevice) {
        if (readings.length < 2) {
          usageByDevice.set(deviceId, 0);
          continue;
        }
        const min = Math.min(...readings);
        const max = Math.max(...readings);
        const usage = Math.max(0, max - min);
        usageByDevice.set(deviceId, usage);
        totalKwh += usage;
      }
      return { totalKwh, byDevice: usageByDevice };
    }

    const thisWeek = computeUsage(thisWeekLogs ?? null);
    const lastWeek = computeUsage(lastWeekLogs ?? null);
    const monthUsage = computeUsage(monthLogs ?? null);

    const monthCostPhp = computeMeralcoBill(
      monthUsage.totalKwh,
      meralcoData.rates,
      meralcoData.vatRate,
      { fixedChargesPhp: meralcoData.fixedMonthlyChargesPhp }
    );

    const daysElapsed = Math.max(1, now.getDate());
    const projectedMonthly = (monthCostPhp / daysElapsed) * 30;

    // Map device IDs to names (handle both UUID and MAC)
    const deviceNameMap = new Map<string, string>();
    for (const d of devices) {
      deviceNameMap.set(d.id, d.device_name);
      if (d.mac_address) deviceNameMap.set(d.mac_address, d.device_name);
    }

    // Build top devices string
    const topDevices = Array.from(monthUsage.byDevice.entries())
      .map(([id, kwh]) => ({
        name: deviceNameMap.get(id) ?? id,
        kwh,
        cost: computeMeralcoBill(kwh, meralcoData.rates, meralcoData.vatRate),
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 3);

    const topDevicesStr = topDevices
      .map((d) => `${d.name}: ${d.kwh.toFixed(2)} kWh (₱${d.cost.toFixed(2)})`)
      .join(", ");

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

    // --- Build type-specific prompt ---
    let userPrompt = "";

    switch (typedInsightType) {
      case "budget_alert":
        userPrompt = `User's monthly budget: ₱${monthlyBudget.toFixed(2)}.
Current month spend so far: ₱${monthCostPhp.toFixed(2)} (${daysElapsed} days elapsed).
Projected monthly total: ₱${projectedMonthly.toFixed(2)}.
Top consuming devices this month: ${topDevicesStr || "No data yet"}.

Give a budget alert. If they're on track, be encouraging. If they're trending over budget, warn them with specific device advice. Use "Naku!" for over-budget, "Bida ka!" for under-budget.`;
        break;

      case "weekly_recap":
        userPrompt = `This week's total usage: ${thisWeek.totalKwh.toFixed(2)} kWh (₱${thisWeekCost.toFixed(2)}).
Last week's total usage: ${lastWeek.totalKwh.toFixed(2)} kWh (₱${lastWeekCost.toFixed(2)}).
Week-over-week change: ${((thisWeek.totalKwh - lastWeek.totalKwh) / Math.max(0.01, lastWeek.totalKwh) * 100).toFixed(1)}%.
Top devices this week: ${topDevicesStr || "No data yet"}.

Give an encouraging weekly recap comparing this week vs last week. Highlight wins or areas to improve. Be specific about which devices and amounts.`;
        break;

      case "anomaly_alert":
        userPrompt = `This week's usage: ${thisWeek.totalKwh.toFixed(2)} kWh (₱${thisWeekCost.toFixed(2)}).
Last week's usage: ${lastWeek.totalKwh.toFixed(2)} kWh (₱${lastWeekCost.toFixed(2)}).
Top consuming devices: ${topDevicesStr || "No data yet"}.
Number of devices: ${devices.length}.

Check if there are any anomalies — unusual spikes in usage, a single device consuming disproportionately, or significant week-over-week jumps. If everything looks normal, say so briefly. If anomalous, explain what stands out and recommend action.`;
        break;

      case "cost_optimizer":
        userPrompt = `Monthly budget: ₱${monthlyBudget.toFixed(2)}.
Current month spend: ₱${monthCostPhp.toFixed(2)} (Day ${daysElapsed}).
Projected monthly: ₱${projectedMonthly.toFixed(2)}.
Top devices by cost: ${topDevicesStr || "No data yet"}.
User has ${devices.length} appliance(s): ${devices.map((d) => d.device_name).join(", ")}.

Give one specific, actionable cost-saving tip. Recommend which device to adjust, by how much (hours or schedule), and the estimated savings. Be concrete with ₱ amounts.`;
        break;
    }

    // --- Call OpenAI ---
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    const message =
      completion.choices[0]?.message?.content?.trim() ??
      "Hindi ko ma-generate ang insight ngayon, boss. Try again later!";

    const promptTokens = completion.usage?.prompt_tokens ?? 0;
    const completionTokens = completion.usage?.completion_tokens ?? 0;

    // --- Cache result ---
    await supabase.from("ai_insights").insert({
      user_id: user.id,
      insight_type: typedInsightType,
      message,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
    });

    return NextResponse.json({
      message,
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
