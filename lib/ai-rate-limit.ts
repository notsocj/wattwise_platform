import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Per account, across every signed-in AI feature except the customer assistant,
// which has its own limit on customer_ai_messages.
export const AI_REQUESTS_PER_MINUTE = 10;
export const AI_REQUESTS_PER_DAY = 200;

/**
 * Counts one OpenAI request for this account (migration 048). Returns null when
 * it may go ahead, or the response to send instead: 429 over the limit, 503 if
 * the limiter itself fails, so the route never becomes an unmetered OpenAI proxy.
 * Call it right before the OpenAI request, after any cache hit has returned.
 */
export async function takeAiRequestSlot(userId: string): Promise<NextResponse | null> {
  const { data, error } = await createAdminClient().rpc("take_ai_request_slot", {
    p_user_id: userId,
    p_per_minute: AI_REQUESTS_PER_MINUTE,
    p_per_day: AI_REQUESTS_PER_DAY,
  });
  if (error) {
    console.error("AI rate limit error", error);
    return NextResponse.json({ error: "AI features are busy right now. Try again in a minute." }, { status: 503 });
  }
  if (data === "minute") {
    return NextResponse.json({ error: "Too many AI requests. Wait a minute, then try again." }, { status: 429 });
  }
  if (data === "day") {
    return NextResponse.json({ error: "You've reached today's AI limit. It resets within 24 hours." }, { status: 429 });
  }
  return null;
}
