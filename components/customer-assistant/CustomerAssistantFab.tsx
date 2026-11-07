"use client";

import { Check, ChevronRight, Send, X } from "lucide-react";
import BrandMark from "@/components/ui/BrandMark";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LoadingIndicator from "@/components/ui/LoadingIndicator";
import type { CustomerAssistantMessage } from "@/lib/customer-assistant-types";

const quickPrompts = [
  "Why is my bill high?",
  "Check my budget",
  "Help me save energy",
  "Change a device limit",
] as const;

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

export default function CustomerAssistantFab() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<CustomerAssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setIsLoadingHistory(true);
    setError(null);
    fetch("/api/customer-assistant/messages")
      .then(async (response) => {
        const body = await readJson(response);
        if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not load chat history.");
        if (active) setMessages((body.messages as CustomerAssistantMessage[]) ?? []);
      })
      .catch((reason: unknown) => active && setError(reason instanceof Error ? reason.message : "Could not load chat history."))
      .finally(() => active && setIsLoadingHistory(false));
    return () => { active = false; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isOpen, isSending]);

  useEffect(() => {
    if (!isOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  function toFriendlyError(reason: unknown, fallback: string): string {
    // fetch rejects with a TypeError ("Failed to fetch") when offline.
    if (reason instanceof TypeError) return "Couldn't reach WattWise. Check your connection and try again.";
    return reason instanceof Error ? reason.message : fallback;
  }

  async function sendMessage(text = input) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    setInput("");
    setError(null);
    setIsSending(true);
    const optimistic: CustomerAssistantMessage = {
      id: `temporary-${Date.now()}`,
      role: "user",
      content: trimmed,
      proposal: null,
      proposal_status: null,
      proposal_result: null,
      display_data: null,
      created_at: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic].slice(-10));
    try {
      const response = await fetch("/api/customer-assistant/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const body = await readJson(response);
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "The assistant could not reply.");
      setMessages((current) => [...current, body.message as CustomerAssistantMessage].slice(-10));
    } catch (reason) {
      // Drop the unsent bubble and give the text back so it can be retried.
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
      setInput((current) => current || trimmed);
      setError(toFriendlyError(reason, "The assistant could not reply."));
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }

  async function confirmChange(messageId: string) {
    if (confirmingId) return;
    setConfirmingId(messageId);
    setError(null);
    try {
      const response = await fetch(`/api/customer-assistant/actions/${messageId}/confirm`, { method: "POST" });
      const body = await readJson(response);
      if (response.status === 409) {
        // Already claimed by another tap or tab; it is not a failure.
        setError("This change is already being applied. It will show up in a moment.");
        router.refresh();
        return;
      }
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "The change could not be applied.");
      setMessages((current) => current.map((message) =>
        message.id === messageId
          ? { ...message, proposal_status: "confirmed", proposal_result: body.result as { message?: string } }
          : message
      ));
      router.refresh();
    } catch (reason) {
      const message = toFriendlyError(reason, "The change could not be applied.");
      setError(message);
      setMessages((current) => current.map((item) =>
        item.id === messageId ? { ...item, proposal_status: "failed", proposal_result: { message } } : item
      ));
    } finally {
      setConfirmingId(null);
    }
  }

  return (
    <>
      <div className="pointer-events-none fixed bottom-[82px] left-1/2 z-[60] w-full max-w-[430px] -translate-x-1/2 lg:bottom-8 lg:left-auto lg:right-8 lg:w-auto lg:max-w-none lg:translate-x-0">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open WattWise AI Assistant"
          className="pointer-events-auto ml-auto mr-4 flex h-14 w-14 items-center justify-center rounded-full border border-mint/40 bg-mint text-ink shadow-lg shadow-black/30 transition-transform duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint active:scale-[0.97] lg:mr-0 hover:scale-105"
        >
          <BrandMark className="h-7 w-7 text-ink" />
        </button>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/65 transition-opacity duration-200 ease-out starting:opacity-0 lg:justify-end lg:bg-black/40 lg:p-8" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setIsOpen(false);
        }}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-assistant-title"
            className="flex max-h-[78dvh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[28px] border border-fg/10 bg-canvas shadow-2xl transition-[translate,scale,opacity] duration-[400ms] ease-drawer starting:translate-y-full lg:h-[min(680px,calc(100dvh-4rem))] lg:max-h-none lg:max-w-[420px] lg:origin-bottom-right lg:rounded-[24px] lg:duration-200 lg:ease-out lg:starting:translate-y-0 lg:starting:scale-[0.96] lg:starting:opacity-0"
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-fg/20 lg:hidden" />
            <header className="flex items-center justify-between border-b border-fg/[0.07] px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint/10 text-accent">
                  <BrandMark className="h-6 w-6" />
                </div>
                <div>
                  <h2 id="customer-assistant-title" className="text-sm font-bold text-fg">WattWise Assistant</h2>
                  <p className="text-[11px] text-fg/45">Energy and budget help in Taglish</p>
                </div>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} aria-label="Close assistant" className="flex h-9 w-9 items-center justify-center rounded-full border border-fg/10 text-fg/60 hover:text-fg">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </header>

            <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
              {isLoadingHistory ? (
                <div className="flex min-h-40 items-center justify-center"><LoadingIndicator label="Loading conversation" /></div>
              ) : messages.length === 0 ? (
                <div className="rounded-2xl border border-mint/15 bg-mint/[0.06] p-4">
                  <p className="text-sm font-semibold text-fg">Kumusta! How can I help?</p>
                  <p className="mt-1 text-xs leading-5 text-fg/55">I can explain your current usage and prepare safe setting changes for your review.</p>
                </div>
              ) : null}

              {!isLoadingHistory && messages.length === 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {quickPrompts.map((prompt) => (
                    <button key={prompt} type="button" onClick={() => void sendMessage(prompt)} className="flex items-center justify-between rounded-full border border-fg/10 bg-surface px-3 py-2.5 text-left text-xs text-fg/75 hover:border-mint/30 hover:text-fg">
                      {prompt}<ChevronRight className="h-4 w-4 text-accent" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              ) : null}

              {messages.map((message) => (
                <div key={message.id} className={message.role === "user" ? "ml-10" : "mr-5"}>
                  <div className={`rounded-2xl px-3.5 py-3 text-sm leading-5 ${message.role === "user" ? "rounded-br-md bg-mint text-ink" : "rounded-bl-md border border-fg/10 bg-surface text-fg/80"}`}>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                  {message.display_data?.type === "device_list" ? (
                    <div className="mt-2 space-y-2 rounded-2xl border border-fg/10 bg-surface p-3">
                      <p className="px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-fg/45">
                        {message.display_data.title}
                      </p>
                      {message.display_data.devices.map((device) => {
                        const progress = Math.max(0, Math.min(100, device.progress_percent));
                        const isAtRisk = device.progress_percent >= 80;
                        return (
                          <Link
                            key={device.id}
                            href={`/dashboard/${device.id}`}
                            onClick={() => setIsOpen(false)}
                            className="block rounded-xl border border-fg/[0.08] bg-shade/20 p-3 transition-colors hover:border-mint/30"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-fg">{device.name}</p>
                                {typeof device.calendar_month_spend_php === "number" ? (
                                  <p className="mt-0.5 text-[11px] text-fg/45">
                                    This month: PHP {device.calendar_month_spend_php.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                ) : null}
                                <p className="mt-0.5 text-[11px] text-fg/45">
                                  Current cycle: PHP {device.spend_php.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  {device.limit_php > 0
                                    ? ` / PHP ${device.limit_php.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                    : " · no limit set"}
                                </p>
                              </div>
                              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-fg/35" aria-hidden="true" />
                            </div>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fg/[0.07]">
                              <div
                                className={`h-full rounded-full ${isAtRisk ? "bg-bida" : "bg-mint"}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <div className="mt-2 flex items-center justify-between text-[10px]">
                              <span className={isAtRisk ? "font-semibold text-bida" : "text-fg/45"}>
                                {device.limit_php > 0 ? `${device.progress_percent < 1 ? device.progress_percent.toFixed(1) : device.progress_percent.toFixed(0)}% of limit` : "Limit not configured"}
                              </span>
                              <span className={device.telemetry_state === "fresh" ? "text-accent" : "text-fg/35"}>
                                {device.telemetry_state === "fresh" ? `${device.current_watts} W live` : "Live reading stale"}
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                  {message.proposal ? (
                    <div className="mt-2 overflow-hidden rounded-2xl border border-bida/30 bg-bida/[0.07] p-3.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-bida">Review required</p>
                      <h3 className="mt-1 text-sm font-bold text-fg">{message.proposal.title}</h3>
                      <p className="text-xs text-fg/50">{message.proposal.subject}</p>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-shade/20 p-2"><span className="block text-fg/40">Current</span><strong className="text-fg/75">{message.proposal.current_value}</strong></div>
                        <div className="rounded-lg bg-shade/20 p-2"><span className="block text-fg/40">Proposed</span><strong className="text-bida">{message.proposal.proposed_value}</strong></div>
                      </div>
                      <p className="mt-3 text-[11px] leading-4 text-fg/55">{message.proposal.consequence}</p>
                      {message.proposal_status === "pending" ? (
                        <button type="button" onClick={() => void confirmChange(message.id)} disabled={Boolean(confirmingId)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-mint px-3 py-2.5 text-xs font-bold text-ink disabled:opacity-60">
                          {confirmingId === message.id ? <LoadingIndicator size="sm" label="Confirming" showLabel={false} /> : <Check className="h-4 w-4" aria-hidden="true" />}
                          {confirmingId === message.id ? "Applying..." : "Confirm change"}
                        </button>
                      ) : (
                        <p className={`mt-3 text-xs font-semibold ${message.proposal_status === "confirmed" ? "text-accent" : "text-danger"}`}>
                          {message.proposal_result?.message ?? (message.proposal_status === "confirmed" ? "Change confirmed." : "This proposal is no longer available.")}
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
              {isSending ? <div className="mr-20 rounded-2xl rounded-bl-md border border-fg/10 bg-surface px-4 py-3"><LoadingIndicator size="sm" label="Thinking" /></div> : null}
              {error ? <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p> : null}
            </div>

            <form onSubmit={(event) => { event.preventDefault(); void sendMessage(); }} className="border-t border-fg/[0.07] bg-canvas p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
              <div className="flex items-center gap-2 rounded-full border border-fg/10 bg-surface p-1.5 pl-3 transition-colors duration-150 ease-out focus-within:border-mint/40">
                <input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} maxLength={1000} disabled={isSending || isLoadingHistory} placeholder="Ask about your energy use..." aria-label="Message WattWise Assistant" className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-fg outline-none placeholder:text-fg/30 disabled:opacity-50" />
                <button type="submit" disabled={!input.trim() || isSending || isLoadingHistory} aria-label="Send message" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mint text-ink disabled:cursor-not-allowed disabled:opacity-35">
                  <Send className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <p className="mt-1.5 text-center text-[11px] text-fg/50">Review every proposed change before confirming.</p>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
