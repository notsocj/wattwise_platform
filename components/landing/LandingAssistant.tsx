"use client";

import Link from "next/link";
import FloatingChat, { type ChatTurn } from "@/components/ui/FloatingChat";
import { PUBLIC_CHAT_HISTORY_LIMIT, PUBLIC_CHAT_MESSAGE_LIMIT } from "@/lib/public-assistant-policy";

async function askPublicAssistant(message: string, history: ChatTurn[]) {
  const response = await fetch("/api/public-assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
  const body = (await response.json().catch(() => ({}))) as { reply?: string; error?: string };
  if (!response.ok || !body.reply) throw new Error(body.error ?? "The chat is unavailable right now. Please try again.");
  return body.reply;
}

/** Signed-out chatbot on the landing page: answers questions about WattWise only. */
export default function LandingAssistant() {
  return (
    <FloatingChat
      title="Ask WattWise"
      tagline="Questions about WattWise"
      greeting={{
        title: "Kumusta! I'm the WattWise guide.",
        body: "Ask me what WattWise does, how it works, or how it helps you save on your Meralco bill.",
      }}
      quickPrompts={["What is WattWise?", "How does it cut my bill?", "How do I set it up?", "Can landlords use it for tenants?"]}
      placeholder="Ask about WattWise..."
      maxLength={PUBLIC_CHAT_MESSAGE_LIMIT}
      historyLimit={PUBLIC_CHAT_HISTORY_LIMIT}
      send={askPublicAssistant}
      trigger="pill"
      triggerClassName="bottom-5 right-5 lg:bottom-8 lg:right-8"
      footer={
        <>
          Already a user?{" "}
          <Link href="/login" className="font-semibold text-accent hover:underline">
            Log in
          </Link>{" "}
          for help with your own bill.
        </>
      }
    />
  );
}
