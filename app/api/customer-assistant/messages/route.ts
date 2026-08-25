import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  CUSTOMER_ASSISTANT_HISTORY_LIMIT,
  CUSTOMER_ASSISTANT_MESSAGE_LIMIT,
  CUSTOMER_ASSISTANT_RATE_LIMIT,
  CUSTOMER_ASSISTANT_RATE_WINDOW_MS,
  isCustomerRole,
} from "@/lib/customer-assistant-policy";
import {
  buildCustomerAssistantContext,
  generateCustomerAssistantReply,
  resolveModelDisplay,
  resolveModelProposal,
} from "@/lib/customer-assistant-server";
import { buildGroundedCustomerResponse } from "@/lib/customer-assistant-grounding";
import type { CustomerAssistantMessage } from "@/lib/customer-assistant-types";

type Profile = {
  role: string | null;
  monthly_budget_php: number | string | null;
  billing_cycle_start_day: number | null;
};

async function getSession() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role,monthly_budget_php,billing_cycle_start_day")
    .eq("id", user.id)
    .maybeSingle<Profile>();
  if (!profile || !isCustomerRole(profile.role)) return null;
  return { supabase, user, profile: { ...profile, role: profile.role } };
}

async function trimHistory(userId: string) {
  const admin = createAdminClient();
  const { data: stale } = await admin
    .from("customer_ai_messages")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(CUSTOMER_ASSISTANT_HISTORY_LIMIT, CUSTOMER_ASSISTANT_HISTORY_LIMIT + 100);
  const ids = (stale ?? []).map((row) => row.id);
  if (ids.length) await admin.from("customer_ai_messages").delete().in("id", ids);
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Customer access required." }, { status: 403 });
  const { data, error } = await createAdminClient()
    .from("customer_ai_messages")
    .select("id,role,content,proposal,proposal_status,proposal_result,display_data,created_at")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(CUSTOMER_ASSISTANT_HISTORY_LIMIT);
  if (error) return NextResponse.json({ error: "Chat history is not ready. Apply the latest database migration." }, { status: 503 });
  const messages = ((data ?? []) as CustomerAssistantMessage[]).reverse();
  const expiredIds = messages
    .filter((message) =>
      message.proposal_status === "pending" &&
      message.proposal &&
      Date.now() > new Date(message.proposal.expires_at).getTime()
    )
    .map((message) => message.id);
  if (expiredIds.length) {
    await createAdminClient()
      .from("customer_ai_messages")
      .update({ proposal_status: "expired" })
      .in("id", expiredIds)
      .eq("user_id", session.user.id)
      .eq("proposal_status", "pending");
    for (const message of messages) {
      if (expiredIds.includes(message.id)) message.proposal_status = "expired";
    }
  }
  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Customer access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { message?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message || message.length > CUSTOMER_ASSISTANT_MESSAGE_LIMIT) {
    return NextResponse.json({ error: `Enter a message between 1 and ${CUSTOMER_ASSISTANT_MESSAGE_LIMIT} characters.` }, { status: 400 });
  }

  const admin = createAdminClient();
  const windowStart = new Date(Date.now() - CUSTOMER_ASSISTANT_RATE_WINDOW_MS).toISOString();
  const { count } = await admin
    .from("customer_ai_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", session.user.id)
    .eq("role", "user")
    .gte("created_at", windowStart);
  if ((count ?? 0) >= CUSTOMER_ASSISTANT_RATE_LIMIT) {
    return NextResponse.json({ error: "You’ve sent several messages. Please wait a few minutes before trying again." }, { status: 429 });
  }

  const { data: recent } = await admin
    .from("customer_ai_messages")
    .select("role,content")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(6);
  const history = (recent ?? []).reverse().filter(
    (row): row is { role: "user" | "assistant"; content: string } =>
      (row.role === "user" || row.role === "assistant") && typeof row.content === "string"
  );
  const { error: userInsertError } = await admin.from("customer_ai_messages").insert({
    user_id: session.user.id,
    role: "user",
    content: message,
  });
  if (userInsertError) return NextResponse.json({ error: "Chat history is not ready. Apply the latest database migration." }, { status: 503 });

  const context = await buildCustomerAssistantContext(session.supabase, session.user.id, session.profile);
  const grounded = buildGroundedCustomerResponse(message, context);
  const generated = grounded
    ? { reply: grounded.reply, rawAction: null, rawDisplay: null, fallback: false }
    : await generateCustomerAssistantReply(message, history, context);
  const resolved = resolveModelProposal(generated.rawAction, context);
  const content = resolved.refusal ?? generated.reply;
  const displayData = grounded?.display ?? resolveModelDisplay(generated.rawDisplay, context);
  const { data: assistant, error } = await admin
    .from("customer_ai_messages")
    .insert({
      user_id: session.user.id,
      role: "assistant",
      content,
      proposal: resolved.proposal,
      proposal_status: resolved.proposal ? "pending" : null,
      display_data: displayData,
    })
    .select("id,role,content,proposal,proposal_status,proposal_result,display_data,created_at")
    .single<CustomerAssistantMessage>();
  if (error || !assistant) return NextResponse.json({ error: "The assistant could not save its reply." }, { status: 500 });
  await trimHistory(session.user.id);
  return NextResponse.json({ message: assistant, fallback: generated.fallback });
}
