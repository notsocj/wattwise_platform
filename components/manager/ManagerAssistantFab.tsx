"use client";

import FloatingChat, { type ChatTurn } from "@/components/ui/FloatingChat";

async function askManagerAssistant(message: string, history: ChatTurn[]) {
  const response = await fetch("/api/manager/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [...history, { role: "user", content: message }] }),
  });
  const body = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
  if (!response.ok) throw new Error(body.error ?? "The assistant could not reply right now.");
  return body.message?.trim() || "No clear answer yet. Try asking about a specific room.";
}

/** Manager AI on every manager page: advisory chat about the fleet, rooms, and tenants. */
export default function ManagerAssistantFab() {
  return (
    <FloatingChat
      title="Manager Assistant"
      tagline="Fleet, rooms, and tenant spend"
      greeting={{
        title: "Hi boss, ready ako.",
        body: "Ask about room cutoff risk, tenant spend, relay status, or units that stopped reporting. I only advise; changes stay in your controls.",
      }}
      quickPrompts={["Which rooms are close to their limit?", "Any units offline?", "Summarize this cycle's spend", "Which tenant uses the most?"]}
      placeholder="Ask about your rooms..."
      maxLength={1000}
      historyLimit={7}
      send={askManagerAssistant}
      trigger="icon"
      triggerClassName="bottom-[calc(84px+env(safe-area-inset-bottom))] right-4 lg:bottom-8 lg:right-8"
      footer="Advice only. Limits, rooms, and relays change only through your controls."
    />
  );
}
