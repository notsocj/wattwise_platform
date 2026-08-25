import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  canRoleConfirmAction,
  isCustomerAssistantProposal,
  isCustomerRole,
  isExpiredProposal,
  validatePesoValue,
} from "@/lib/customer-assistant-policy";
import type { CustomerAssistantProposal, CustomerRole } from "@/lib/customer-assistant-types";

type Profile = { role: string | null };
type Device = {
  id: string;
  device_name: string;
  user_approved_limit_php: number | string | null;
  require_approval_on_expiry: boolean | null;
};

function resultMessage(proposal: CustomerAssistantProposal): string {
  switch (proposal.action.type) {
    case "update_home_budget": return `Home budget updated to ${proposal.proposed_value}.`;
    case "update_device_limit": return `${proposal.subject} limit updated to ${proposal.proposed_value}.`;
    case "set_auto_cutoff": return `Automatic cutoff for ${proposal.subject} is now ${proposal.action.enabled ? "enabled" : "disabled"}.`;
    case "set_notification_preference": return `${proposal.subject} is now ${proposal.action.enabled ? "enabled" : "disabled"}.`;
  }
}

export async function POST(
  _request: NextRequest,
  props: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await props.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle<Profile>();
  if (!profile || !isCustomerRole(profile.role)) return NextResponse.json({ error: "Customer access required." }, { status: 403 });

  const admin = createAdminClient();
  const { data: message } = await admin
    .from("customer_ai_messages")
    .select("id,proposal,proposal_status,created_at")
    .eq("id", messageId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!message || !isCustomerAssistantProposal(message.proposal)) {
    return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
  }
  if (message.proposal_status !== "pending") {
    return NextResponse.json({ error: "This proposal was already handled." }, { status: 409 });
  }
  if (isExpiredProposal(message.created_at) || Date.now() > new Date(message.proposal.expires_at).getTime()) {
    await admin.from("customer_ai_messages").update({ proposal_status: "expired" }).eq("id", message.id).eq("proposal_status", "pending");
    return NextResponse.json({ error: "This proposal expired. Ask the assistant to prepare a fresh one." }, { status: 410 });
  }
  const proposal = message.proposal;
  if (!canRoleConfirmAction(profile.role as CustomerRole, proposal.action)) {
    return NextResponse.json({ error: "Your role cannot confirm this setting change." }, { status: 403 });
  }
  const { data: claimed } = await admin
    .from("customer_ai_messages")
    .update({ proposal_status: "processing" })
    .eq("id", message.id)
    .eq("user_id", user.id)
    .eq("proposal_status", "pending")
    .select("id")
    .maybeSingle();
  if (!claimed) return NextResponse.json({ error: "This proposal is already being processed." }, { status: 409 });

  try {
    const action = proposal.action;
    if (action.type === "update_home_budget") {
      const value = validatePesoValue(action.value);
      if (value === null) throw new Error("The proposed budget is invalid.");
      const { error } = await supabase.from("profiles").update({ monthly_budget_php: value }).eq("id", user.id);
      if (error) throw new Error("The home budget could not be updated.");
    } else if (action.type === "set_notification_preference") {
      const column = action.channel === "push" ? "budget_push_enabled" : "budget_email_enabled";
      const { error } = await supabase.from("notification_preferences").update({ [column]: action.enabled }).eq("user_id", user.id);
      if (error) throw new Error("The notification preference could not be updated.");
    } else {
      const { data: device } = await supabase
        .from("devices")
        .select("id,device_name,user_approved_limit_php,require_approval_on_expiry")
        .eq("id", action.device_id)
        .or(`owner_id.eq.${user.id},user_id.eq.${user.id}`)
        .maybeSingle<Device>();
      if (!device) throw new Error("The device is no longer manageable by this account.");
      const currentLimit = validatePesoValue(Number(device.user_approved_limit_php));
      const nextLimit = action.type === "update_device_limit" ? validatePesoValue(action.value) : currentLimit;
      if (nextLimit === null) throw new Error("Set a positive device limit before applying this change.");
      const autoCutoff = action.type === "set_auto_cutoff" ? action.enabled : device.require_approval_on_expiry === false;
      const { error } = await supabase.rpc("apply_device_budget_settings", {
        p_device_id: device.id,
        p_limit_php: nextLimit,
        p_auto_cutoff_enabled: autoCutoff,
      });
      if (error) throw new Error("The device safety setting could not be updated.");
    }
    const result = { message: resultMessage(proposal) };
    await admin.from("customer_ai_messages").update({
      proposal_status: "confirmed",
      proposal_result: result,
      confirmed_at: new Date().toISOString(),
    }).eq("id", message.id).eq("proposal_status", "processing");
    return NextResponse.json({ status: "confirmed", result });
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "The setting change could not be applied.";
    await admin.from("customer_ai_messages").update({
      proposal_status: "failed",
      proposal_result: { message: safeMessage },
    }).eq("id", message.id).eq("proposal_status", "processing");
    return NextResponse.json({ error: safeMessage }, { status: 400 });
  }
}
