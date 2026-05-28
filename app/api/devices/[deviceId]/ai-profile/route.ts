import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { computeMeralcoBill, getActiveMeralcoRates } from "@/lib/meralco-rates";

const FRESH_READING_WINDOW_MS = 20 * 1000;
const FALLBACK_PROMPT_RATE_PHP_PER_KWH = 12;
const AI_SAFETY_FACTOR_PHP_PER_KWH = 12;

type DeviceRow = {
  id: string;
  device_name: string;
  mac_address: string;
  appliance_type: string | null;
};

type LatestTelemetryRow = {
  average_watts: number | string | null;
  voltage_v: number | string | null;
  current_a: number | string | null;
  recorded_at: string | null;
};

type BaselinePayload = {
  baseline_watts?: unknown;
  voltage_v?: unknown;
  current_a?: unknown;
};

type AiProfileModelResponse = {
  estimated_monthly_kwh: number;
  suggested_monthly_limit_php: number;
  taglish_advice: string;
};

type AiProfileResponse = AiProfileModelResponse & {
  estimated_monthly_cost_php: number;
  baseline_watts: number;
  voltage_v: number | null;
  current_a: number | null;
  prompt_rate_php_per_kwh: number;
  prompt_rate_source: "table" | "fallback";
};

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isFresh(recordedAt: string | null): boolean {
  if (!recordedAt) {
    return false;
  }

  const timestamp = new Date(recordedAt).getTime();
  return !Number.isNaN(timestamp) && Date.now() - timestamp <= FRESH_READING_WINDOW_MS;
}

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

function sanitizeAiProfile(parsed: unknown, fallback: AiProfileResponse): AiProfileResponse {
  const record = parsed && typeof parsed === "object"
    ? (parsed as Record<string, unknown>)
    : {};
  const estimatedMonthlyKWh = Number(record.estimated_monthly_kwh);
  const suggestedLimit = Number(record.suggested_monthly_limit_php);
  const taglishAdvice =
    typeof record.taglish_advice === "string" && record.taglish_advice.trim()
      ? record.taglish_advice.trim()
      : fallback.taglish_advice;

  return {
    ...fallback,
    estimated_monthly_kwh:
      Number.isFinite(estimatedMonthlyKWh) && estimatedMonthlyKWh > 0
        ? Number(estimatedMonthlyKWh.toFixed(2))
        : fallback.estimated_monthly_kwh,
    suggested_monthly_limit_php:
      Number.isFinite(suggestedLimit) && suggestedLimit > 0
        ? Number(suggestedLimit.toFixed(2))
        : fallback.suggested_monthly_limit_php,
    taglish_advice: taglishAdvice,
  };
}

async function getPromptRatePhpPerKwh(supabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    const activeRates = await getActiveMeralcoRates(supabase);

    return {
      ratePhpPerKwh: computeMeralcoBill(1, activeRates.rates, activeRates.vatRate),
      source: "table" as const,
    };
  } catch {
    // This fallback is limited to AI profiling copy, not billing-grade cost computation.
    return {
      ratePhpPerKwh: FALLBACK_PROMPT_RATE_PHP_PER_KWH,
      source: "fallback" as const,
    };
  }
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ deviceId: string }> }
) {
  const { deviceId } = await props.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string | null }>();

  if (profile?.role === "tenant") {
    return NextResponse.json(
      { error: "Tenants cannot profile appliances." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const dailyHours = Number((body as { daily_usage_hours?: unknown }).daily_usage_hours);

  if (!Number.isFinite(dailyHours) || dailyHours < 1 || dailyHours > 24) {
    return NextResponse.json(
      { error: "daily_usage_hours must be a number from 1 to 24." },
      { status: 400 }
    );
  }

  const { data: device, error: deviceError } = await supabase
    .from("devices")
    .select("id, device_name, mac_address, appliance_type")
    .eq("id", deviceId)
    .or(`owner_id.eq.${user.id},user_id.eq.${user.id}`)
    .maybeSingle<DeviceRow>();

  if (deviceError || !device) {
    return NextResponse.json(
      { error: "Device not found or not owned by you." },
      { status: 404 }
    );
  }

  const { data: latestTelemetry, error: telemetryError } = await supabase
    .from("energy_logs")
    .select("average_watts, voltage_v, current_a, recorded_at")
    .in("device_id", [device.id, device.mac_address])
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle<LatestTelemetryRow>();

  let baselineWatts =
    latestTelemetry && isFresh(latestTelemetry.recorded_at)
      ? Math.max(0, toFiniteNumber(latestTelemetry.average_watts) ?? 0)
      : 0;
  let voltageV =
    latestTelemetry && isFresh(latestTelemetry.recorded_at)
      ? toFiniteNumber(latestTelemetry.voltage_v)
      : null;
  let currentA =
    latestTelemetry && isFresh(latestTelemetry.recorded_at)
      ? toFiniteNumber(latestTelemetry.current_a)
      : null;

  if (
    (!latestTelemetry || !isFresh(latestTelemetry.recorded_at) || telemetryError) &&
    body &&
    typeof body === "object"
  ) {
    const payload = body as BaselinePayload;
    baselineWatts = Math.max(0, toFiniteNumber(payload.baseline_watts) ?? 0);
    voltageV = toFiniteNumber(payload.voltage_v);
    currentA = toFiniteNumber(payload.current_a);
  }

  if (baselineWatts <= 0) {
    return NextResponse.json(
      {
        error:
          "No fresh telemetry yet. Keep the WattWise device powered on and wait for a live reading.",
      },
      { status: 409 }
    );
  }

  const { ratePhpPerKwh, source } = await getPromptRatePhpPerKwh(supabase);
  const estimatedMonthlyKWh = (baselineWatts / 1000) * dailyHours * 30;
  const estimatedMonthlyCostPhp = estimatedMonthlyKWh * ratePhpPerKwh;
  const fallbackSuggestedLimit = Math.max(
    50,
    Math.round(estimatedMonthlyKWh * AI_SAFETY_FACTOR_PHP_PER_KWH)
  );

  const fallback: AiProfileResponse = {
    estimated_monthly_kwh: Number(estimatedMonthlyKWh.toFixed(2)),
    estimated_monthly_cost_php: Number(estimatedMonthlyCostPhp.toFixed(2)),
    suggested_monthly_limit_php: Number(fallbackSuggestedLimit.toFixed(2)),
    taglish_advice: `Boss, kung nasa ${baselineWatts.toFixed(0)}W ang appliance mo at ginagamit mo nang ${dailyHours} oras kada araw, tantya natin nasa ${estimatedMonthlyKWh.toFixed(2)} kWh ka this month. Safe na panimulang limit ang PHP ${fallbackSuggestedLimit.toFixed(2)} para may konting allowance ka habang ino-observe pa natin ang actual usage.`,
    baseline_watts: Number(baselineWatts.toFixed(2)),
    voltage_v: voltageV === null ? null : Number(voltageV.toFixed(2)),
    current_a: currentA === null ? null : Number(currentA.toFixed(2)),
    prompt_rate_php_per_kwh: Number(ratePhpPerKwh.toFixed(4)),
    prompt_rate_source: source,
  };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI API key not configured. Add OPENAI_API_KEY to .env.local." },
      { status: 500 }
    );
  }

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 300,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Act as an expert energy consultant in the Philippines. You speak in a casual, practical Taglish tone. To calculate the estimated_monthly_kwh, you MUST use this exact formula: (Baseline Watts / 1000) * Daily Hours * 30. Do not guess or estimate the kWh based on the appliance type. Calculate it strictly based on the user\'s provided watts and hours. Base the suggested_monthly_limit_php by multiplying your calculated kWh by a safety factor of 12 PHP/kWh. Respond strictly as raw JSON with exactly these keys: {"estimated_monthly_kwh": number, "suggested_monthly_limit_php": number, "taglish_advice": string}. Do not include markdown, code fences, or extra keys.',
        },
        {
          role: "user",
          content: JSON.stringify({
            appliance_name: device.device_name,
            appliance_type: device.appliance_type ?? "other",
            baseline_watts: fallback.baseline_watts,
            voltage_v: fallback.voltage_v,
            current_a: fallback.current_a,
            daily_usage_hours: dailyHours,
            estimated_daily_hours: dailyHours,
            safety_factor_php_per_kwh: AI_SAFETY_FACTOR_PHP_PER_KWH,
            calculation_rule:
              "estimated_monthly_kwh = (baseline_watts / 1000) * daily_usage_hours * 30",
            limit_rule:
              "suggested_monthly_limit_php = estimated_monthly_kwh * safety_factor_php_per_kwh",
            output_schema: {
              estimated_monthly_kwh: "number",
              suggested_monthly_limit_php: "number",
              taglish_advice: "string",
            },
          }),
        },
      ],
    });

    const profile = sanitizeAiProfile(
      parseJsonObject(completion.choices[0]?.message?.content),
      fallback
    );

    return NextResponse.json(profile);
  } catch (error) {
    console.error("ai-profile: OpenAI request failed", error);
    return NextResponse.json(fallback);
  }
}
