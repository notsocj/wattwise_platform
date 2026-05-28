import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import type {
  CalendarAnalyticsDayPayload,
  CalendarAnalyticsRequest,
  CalendarAnalyticsResponse,
} from "@/lib/calendar-ai";

const SYSTEM_PROMPT = `You are WattWise Tipid Advisor, a Filipino energy consultant.
Language: Casual conversational Taglish.
Tone: Practical, warm, and specific to the user's data.
Analyze grouped daily home energy data and look for habits such as weekend spikes, high-burn days, repeated low-usage streaks, and sudden changes in spend.
If viewer_role is manager, frame the advice around room/fleet operations, tenant hard limits, relay cutoffs, and occupancy context. If viewer_role is tenant, mention assigned-room limits without exposing other rooms.
Respond strictly as raw JSON with this shape:
{
  "headline": string,
  "summary": string,
  "highlights": string[]
}
Keep the summary to 2-4 sentences and highlights to at most 3 short points.
Always reference exact days or peso amounts when they matter.
Do not use markdown, code fences, or extra keys.`;

function isValidDayPayload(value: unknown): value is CalendarAnalyticsDayPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.day_key === "string" &&
    typeof record.weekday === "string" &&
    typeof record.kwh === "number" &&
    Number.isFinite(record.kwh) &&
    typeof record.cost_php === "number" &&
    Number.isFinite(record.cost_php)
  );
}

function parseResponse(content: string | null | undefined): CalendarAnalyticsResponse | null {
  if (!content) {
    return null;
  }

  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (
      typeof parsed.headline !== "string" ||
      typeof parsed.summary !== "string" ||
      !Array.isArray(parsed.highlights)
    ) {
      return null;
    }

    return {
      headline: parsed.headline.trim() || "Calendar Habit Read",
      summary: parsed.summary.trim(),
      highlights: parsed.highlights
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .slice(0, 3),
    };
  } catch {
    return null;
  }
}

function buildFallbackResponse(
  monthLabel: string,
  days: CalendarAnalyticsDayPayload[]
): CalendarAnalyticsResponse {
  const activeDays = days.filter((day) => day.kwh > 0);
  const highestDay = [...days].sort((first, second) => second.cost_php - first.cost_php)[0];
  const weekendDays = days.filter((day) => day.weekday === "SAT" || day.weekday === "SUN");
  const weekendSpend = weekendDays.reduce((sum, day) => sum + day.cost_php, 0);

  return {
    headline: `${monthLabel} Habit Read`,
    summary:
      activeDays.length > 0
        ? `May ${activeDays.length} active day(s) sa ${monthLabel}. Pinakamataas ang burn sa ${highestDay?.day_key ?? "n/a"} at weekend spend mo ay nasa ₱${weekendSpend.toFixed(2)} total.`
        : `Konti pa lang ang usage data sa ${monthLabel}, kaya medyo early pa para sa mas malalim na habit read.`,
    highlights: highestDay
      ? [
          `Highest burn day: ${highestDay.day_key} at ₱${highestDay.cost_php.toFixed(2)}.`,
        ]
      : [],
  };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as CalendarAnalyticsRequest | null;

  if (!body || typeof body.month_label !== "string" || !Array.isArray(body.days)) {
    return NextResponse.json(
      { error: "month_label and days are required." },
      { status: 400 }
    );
  }

  const days = body.days.filter(isValidDayPayload).slice(0, 42);
  if (days.length === 0) {
    return NextResponse.json(buildFallbackResponse(body.month_label, []));
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI API key not configured." },
      { status: 500 }
    );
  }

  const totalCostPhp = days.reduce((sum, day) => sum + day.cost_php, 0);
  const totalKwh = days.reduce((sum, day) => sum + day.kwh, 0);
  const highestDay = [...days].sort((first, second) => second.cost_php - first.cost_php)[0];
  const weekendDays = days.filter((day) => day.weekday === "SAT" || day.weekday === "SUN");
  const weekdayDays = days.filter((day) => day.weekday !== "SAT" && day.weekday !== "SUN");
  const weekendAvg =
    weekendDays.length > 0
      ? weekendDays.reduce((sum, day) => sum + day.cost_php, 0) / weekendDays.length
      : 0;
  const weekdayAvg =
    weekdayDays.length > 0
      ? weekdayDays.reduce((sum, day) => sum + day.cost_php, 0) / weekdayDays.length
      : 0;

  const openai = new OpenAI({ apiKey });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      max_tokens: 350,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: JSON.stringify({
            month_label: body.month_label,
            viewer_role: body.viewer_role ?? "user",
            scope_label: body.scope_label ?? "Home",
            totals: {
              total_kwh: Number(totalKwh.toFixed(2)),
              total_cost_php: Number(totalCostPhp.toFixed(2)),
            },
            highest_day: highestDay ?? null,
            weekend_average_cost_php: Number(weekendAvg.toFixed(2)),
            weekday_average_cost_php: Number(weekdayAvg.toFixed(2)),
            days,
          }),
        },
      ],
    });

    const parsedResponse = parseResponse(completion.choices[0]?.message?.content);

    return NextResponse.json(
      parsedResponse ?? buildFallbackResponse(body.month_label, days)
    );
  } catch (error) {
    console.error("calendar insights error", error);
    return NextResponse.json(buildFallbackResponse(body.month_label, days));
  }
}
