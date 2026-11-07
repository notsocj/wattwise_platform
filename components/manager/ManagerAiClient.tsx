"use client";

import { FormEvent, useState } from "react";
import useSWR from "swr";
import { AlertTriangle, Send, Sparkles } from "lucide-react";
import BrandMark from "@/components/ui/BrandMark";
import LoadingIndicator from "@/components/ui/LoadingIndicator";
import { jsonFetcher } from "@/lib/fetcher";
import type { ManagerFleetSnapshot } from "@/lib/manager-data";

type InsightCard = {
  type: string;
  title: string;
  message: string;
  severity: "info" | "success" | "warning" | "danger";
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ManagerAiClientProps = {
  snapshot: Pick<ManagerFleetSnapshot, "devices" | "totals">;
};

type ManagerInsightsResponse = {
  cards: InsightCard[];
};

function getCardClasses(severity: InsightCard["severity"]): string {
  switch (severity) {
    case "success":
      return "border-mint/30 bg-mint/10";
    case "warning":
      return "border-naku/30 bg-naku/10";
    case "danger":
      return "border-danger/30 bg-danger/10";
    case "info":
    default:
      return "border-fg/[0.06] bg-fg/[0.03]";
  }
}

function getAccentClasses(severity: InsightCard["severity"]): string {
  switch (severity) {
    case "success":
      return "text-accent";
    case "warning":
      return "text-naku";
    case "danger":
      return "text-danger";
    case "info":
    default:
      return "text-fg/55";
  }
}

export default function ManagerAiClient({ snapshot }: ManagerAiClientProps) {
  const {
    data: cardsData,
    error: cardsError,
    isLoading: cardsLoading,
  } = useSWR<ManagerInsightsResponse>(
    "/api/manager/ai/insights",
    (url: string) => jsonFetcher<ManagerInsightsResponse>(url),
    {
      keepPreviousData: true,
    }
  );
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi boss, ready ako. Ask me about room cutoff risk, tenant spend, relay status, or fleet anomalies.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const cards = Array.isArray(cardsData?.cards) ? cardsData.cards : [];
  const cardsErrorMessage =
    cardsError instanceof Error
      ? cardsError.message
      : cardsError
        ? "Could not load manager AI insights."
        : null;

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();

    if (!content || chatLoading) {
      return;
    }

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setDraft("");
    setChatLoading(true);

    try {
      const response = await fetch("/api/manager/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "The assistant could not reply right now."
        );
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            typeof payload.message === "string"
              ? payload.message
              : "No clear AI response yet. Try asking about a specific room.",
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            error instanceof TypeError
              ? "Couldn't reach WattWise. Check your connection and try again."
              : error instanceof Error
                ? error.message
                : "The assistant could not reply right now.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-fg/[0.06] bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-accent/70">
              Fleet Brain
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">
              WattWise Manager Assistant
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-fg/55">
              Advisory-only AI for tenant rooms, hard limits, cutoff risk, and
              stale telemetry.
            </p>
          </div>
          <BrandMark className="h-8 w-8 text-accent" />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        {[
          ["Rooms", snapshot.devices.length],
          ["Assigned", snapshot.totals.assigned_rooms],
          ["Near Limit", snapshot.totals.rooms_at_risk],
          ["Stale", snapshot.totals.offline_rooms],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-fg/[0.06] bg-surface p-4"
          >
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-fg/45">
              {label}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-fg/[0.06] bg-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <h2 className="text-base font-semibold tracking-tight">
            AI Priority Cards
          </h2>
        </div>

        {cardsLoading ? (
          <div className="flex min-h-32 items-center justify-center">
            <LoadingIndicator
              size="md"
              label="Reading manager fleet"
              spinnerClassName="border-fg/20 border-t-mint"
            />
          </div>
        ) : cardsErrorMessage ? (
          <div className="rounded-xl border border-danger/30 bg-danger/10 p-4">
            <p className="flex items-start gap-2 text-sm text-danger">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {cardsErrorMessage}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {cards.map((card) => (
              <article
                key={card.type}
                className={`rounded-xl border p-4 ${getCardClasses(card.severity)}`}
              >
                <p
                  className={`text-[10px] font-bold uppercase tracking-[0.2em] ${getAccentClasses(
                    card.severity
                  )}`}
                >
                  {card.type.replace(/_/g, " ")}
                </p>
                <h3 className="mt-2 text-base font-bold tracking-tight">
                  {card.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-fg/70">
                  {card.message}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-fg/[0.06] bg-surface p-5">
        <h2 className="text-base font-semibold tracking-tight">
          Manager Chatbot
        </h2>
        <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto rounded-xl border border-fg/[0.06] bg-shade/10 p-3">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <p
                className={`max-w-[88%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  message.role === "user"
                    ? "bg-mint text-black"
                    : "bg-fg/[0.05] text-fg/75"
                }`}
              >
                {message.content}
              </p>
            </div>
          ))}
          {chatLoading ? (
            <div className="flex justify-start">
              <div className="rounded-xl bg-fg/[0.05] px-3 py-2">
                <LoadingIndicator size="sm" label="Thinking" />
              </div>
            </div>
          ) : null}
        </div>

        <form onSubmit={(event) => void sendMessage(event)} className="mt-3 flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask about Room 3 cutoff risk..."
            className="min-w-0 flex-1 rounded-xl border border-fg/10 bg-shade/10 px-3 py-3 text-sm text-fg placeholder:text-fg/30 outline-none focus:border-mint/40"
          />
          <button
            type="submit"
            disabled={chatLoading || !draft.trim()}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-mint text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </section>
    </div>
  );
}
