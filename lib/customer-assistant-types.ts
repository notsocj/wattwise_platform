import type { CustomerAssistantDisplay } from "@/lib/customer-assistant-grounding";

export type CustomerRole = "user" | "tenant";

export type CustomerAssistantAction =
  | { type: "update_home_budget"; value: number }
  | { type: "update_device_limit"; device_id: string; value: number }
  | { type: "set_auto_cutoff"; device_id: string; enabled: boolean }
  | {
      type: "set_notification_preference";
      channel: "push" | "email";
      enabled: boolean;
    };

export type CustomerAssistantProposal = {
  action: CustomerAssistantAction;
  title: string;
  subject: string;
  current_value: string;
  proposed_value: string;
  consequence: string;
  expires_at: string;
};

export type CustomerAssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  proposal: CustomerAssistantProposal | null;
  proposal_status:
    | "pending"
    | "processing"
    | "confirmed"
    | "expired"
    | "failed"
    | null;
  proposal_result: { message?: string } | null;
  display_data: CustomerAssistantDisplay | null;
  created_at: string;
};
