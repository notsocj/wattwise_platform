import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { OPENAI_CHAT_MODEL } from "@/lib/openai";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PUBLIC_ASSISTANT_SYSTEM_PROMPT,
  PUBLIC_CHAT_GLOBAL_PER_DAY,
  PUBLIC_CHAT_PER_DAY,
  PUBLIC_CHAT_PER_MINUTE,
  PUBLIC_LIMIT_REPLIES,
  parsePublicChatBody,
  publicGuardReply,
} from "@/lib/public-assistant-policy";

const UNAVAILABLE = "The chat is unavailable right now. Please try again in a few minutes.";

/** Salted hash of the visitor's IP, so the rate-limit table never holds raw addresses. */
function clientHash(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "";
  return createHmac("sha256", salt).update(ip).digest("hex");
}

/** Only this site's own pages may call the chat; other sites and bare scripts are refused. */
function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Public, signed-out chatbot for the landing page. Stores nothing; knows only what WattWise is. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  const parsed = parsePublicChatBody(await request.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data: slot, error: slotError } = await createAdminClient().rpc("take_public_chat_slot", {
    p_client_hash: clientHash(request),
    p_per_minute: PUBLIC_CHAT_PER_MINUTE,
    p_per_day: PUBLIC_CHAT_PER_DAY,
    p_global_per_day: PUBLIC_CHAT_GLOBAL_PER_DAY,
  });
  if (slotError) {
    // Fail closed: without the limiter the endpoint would be an open OpenAI proxy.
    console.error("public assistant rate limit error", slotError);
    return NextResponse.json({ error: UNAVAILABLE }, { status: 503 });
  }
  if (slot !== "ok") {
    const reply = PUBLIC_LIMIT_REPLIES[slot as keyof typeof PUBLIC_LIMIT_REPLIES] ?? PUBLIC_LIMIT_REPLIES.global;
    return NextResponse.json({ error: reply }, { status: 429 });
  }

  const guarded = publicGuardReply(parsed.message);
  if (guarded) return NextResponse.json({ reply: guarded });

  try {
    const completion = await new OpenAI({ apiKey: process.env.OPENAI_API_KEY }).chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      temperature: 0.3,
      max_tokens: 300,
      messages: [
        { role: "system", content: PUBLIC_ASSISTANT_SYSTEM_PROMPT },
        ...parsed.turns,
        { role: "user", content: parsed.message },
      ],
    });
    const reply = completion.choices[0]?.message?.content?.trim();
    if (!reply) throw new Error("Empty reply");
    return NextResponse.json({ reply });
  } catch (error) {
    console.error("public assistant generation error", error);
    return NextResponse.json({ error: UNAVAILABLE }, { status: 503 });
  }
}
