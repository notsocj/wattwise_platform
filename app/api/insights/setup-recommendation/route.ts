import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import {
  computeMeralcoBill,
  getActiveMeralcoRates,
} from "@/lib/meralco-rates";

const TYPICAL_WATTS: Record<string, number> = {
  refrigerator: 150,
  aircon: 950,
  tv: 120,
  other: 200,
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    appliance_type,
    daily_hours,
    home_budget,
  } = body as {
    appliance_type: string;
    daily_hours: number;
    home_budget: number;
  };

  if (
    !appliance_type ||
    !TYPICAL_WATTS[appliance_type] ||
    typeof daily_hours !== "number" ||
    daily_hours < 1 ||
    daily_hours > 24 ||
    typeof home_budget !== "number" ||
    home_budget <= 0
  ) {
    return NextResponse.json(
      { error: "Invalid input. Provide appliance_type, daily_hours (1-24), and home_budget (> 0)." },
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI API key not configured. Add OPENAI_API_KEY to .env.local." },
      { status: 500 }
    );
  }

  let activeRates;
  try {
    activeRates = await getActiveMeralcoRates(supabase);
  } catch {
    return NextResponse.json(
      { error: "No active Meralco rates found. Admin must seed the meralco_rates table." },
      { status: 500 }
    );
  }

  const typicalWatts = TYPICAL_WATTS[appliance_type];
  const estimatedMonthlyKWh = (typicalWatts / 1000) * daily_hours * 30;
  const estimatedMonthlyCost = computeMeralcoBill(
    estimatedMonthlyKWh,
    activeRates.rates,
    activeRates.vatRate
  );
  const suggestedBudget = Math.round(
    Math.min(estimatedMonthlyCost * 1.1, home_budget * 0.5)
  );

  const applianceLabel =
    appliance_type === "refrigerator"
      ? "Refrigerator"
      : appliance_type === "aircon"
        ? "Aircon"
        : appliance_type === "tv"
          ? "TV"
          : "Appliance";

  const openai = new OpenAI({ apiKey });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 250,
    temperature: 0.7,
    messages: [
      {
        role: "system",
        content: `You are a friendly Filipino financial and energy advisor. Speak in casual Taglish (Tagalog-English mix). Be encouraging, practical, and hyper-specific to the user's data. Always reference exact PHP amounts, appliance names, and timeframes. Keep your response to 2-3 sentences max. Do not use emojis.`,
      },
      {
        role: "user",
        content: `I'm setting up a new ${applianceLabel} that I plan to use ${daily_hours} hours per day. Based on current Meralco rates, the estimated monthly cost is PHP ${estimatedMonthlyCost.toFixed(2)} (about ${estimatedMonthlyKWh.toFixed(1)} kWh/month). My total home budget is PHP ${home_budget.toLocaleString()}. What budget limit would you recommend for this ${applianceLabel}?`,
      },
    ],
  });

  const message =
    completion.choices[0]?.message?.content ??
    `Boss, ang estimated monthly cost ng ${applianceLabel} mo ay PHP ${estimatedMonthlyCost.toFixed(2)}. I recommend a limit of PHP ${suggestedBudget.toLocaleString()} para safe ka sa total home budget mo na PHP ${home_budget.toLocaleString()}.`;

  return NextResponse.json({
    message,
    estimated_monthly_kwh: Number(estimatedMonthlyKWh.toFixed(2)),
    estimated_monthly_cost: Number(estimatedMonthlyCost.toFixed(2)),
    suggested_budget: suggestedBudget,
  });
}
