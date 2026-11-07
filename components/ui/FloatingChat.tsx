"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, ChevronRight, Send, X } from "@/components/ui/icons";
import BrandMark from "@/components/ui/BrandMark";

export type ChatTurn = { role: "user" | "assistant"; content: string };

type FloatingChatProps = {
  title: string;
  /** Subtitle under the title while idle. */
  tagline: string;
  greeting: { title: string; body: string };
  quickPrompts: readonly string[];
  placeholder: string;
  maxLength: number;
  /** Turns sent back with each message (the server keeps nothing). */
  historyLimit: number;
  /** Sends one message with earlier turns; resolves to the reply or throws an Error with a friendly message. */
  send: (message: string, history: ChatTurn[]) => Promise<string>;
  /** "icon": round owl button (signed-in apps); "pill": owl with the title (landing page). */
  trigger: "icon" | "pill";
  /** Positions the trigger, e.g. above a bottom tab bar. */
  triggerClassName: string;
  footer?: ReactNode;
};

const ENTER = "transition-[opacity,translate] duration-300 ease-out starting:translate-y-2 starting:opacity-0";

function Avatar() {
  return (
    <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mint/10 text-accent">
      <BrandMark className="h-4 w-4" />
    </span>
  );
}

/**
 * A floating owl button that opens a chat panel (bottom sheet on phones,
 * corner card on desktop). Conversation state lives here for as long as the
 * component stays mounted.
 */
export default function FloatingChat({
  title,
  tagline,
  greeting,
  quickPrompts,
  placeholder,
  maxLength,
  historyLimit,
  send,
  trigger,
  triggerClassName,
  footer,
}: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [turns, setTurns] = useState<(ChatTurn & { id: number })[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);
  const titleId = `${title.replace(/\W+/g, "-").toLowerCase()}-title`;

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();
    // Open at the latest message, without animating the scroll.
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, isSending, error]);

  async function submit(text = input) {
    const message = text.trim();
    if (!message || isSending) return;
    const history = turns.slice(-historyLimit).map(({ role, content }) => ({ role, content }));
    setTurns((current) => [...current, { id: nextId.current++, role: "user", content: message }]);
    setInput("");
    setError(null);
    setIsSending(true);
    try {
      const reply = await send(message, history);
      setTurns((current) => [...current, { id: nextId.current++, role: "assistant", content: reply }]);
    } catch (reason) {
      setError(
        reason instanceof Error && reason.message !== "Failed to fetch"
          ? reason.message
          : "Check your connection and try again."
      );
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={`Open ${title}`}
        aria-haspopup="dialog"
        className={`fixed z-[60] flex items-center justify-center rounded-full border border-mint/40 bg-mint text-ink shadow-lg shadow-black/30 transition-[scale,opacity] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint active:scale-[0.97] print:hidden ${
          trigger === "pill" ? "h-13 gap-2 pl-3 pr-5 text-sm font-bold" : "h-14 w-14"
        } ${isOpen ? "pointer-events-none opacity-0" : ""} ${triggerClassName}`}
      >
        <BrandMark className="h-7 w-7 text-ink" />
        {trigger === "pill" ? title : null}
      </button>

      {isOpen ? (
        <div
          data-lenis-prevent
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/65 transition-opacity duration-200 ease-out starting:opacity-0 lg:justify-end lg:bg-black/40 lg:p-8"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="flex max-h-[78dvh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[28px] border border-fg/10 bg-canvas shadow-2xl transition-[translate,scale,opacity] duration-[400ms] ease-drawer starting:translate-y-full lg:h-[min(640px,calc(100dvh-4rem))] lg:max-h-none lg:max-w-[400px] lg:origin-bottom-right lg:rounded-[24px] lg:duration-200 lg:ease-out lg:starting:translate-y-0 lg:starting:scale-[0.96] lg:starting:opacity-0"
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-fg/20 lg:hidden" />
            <header className="flex items-center justify-between border-b border-fg/[0.07] px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-mint/10 text-accent">
                  <BrandMark className="h-6 w-6" />
                </div>
                <div>
                  <h2 id={titleId} className="text-sm font-bold text-fg">{title}</h2>
                  <p className="flex items-center gap-1.5 text-[11px] text-fg/45">
                    <span className={`h-1.5 w-1.5 rounded-full ${isSending ? "animate-pulse bg-mint" : "bg-mint/70"}`} aria-hidden="true" />
                    {isSending ? "Writing a reply..." : tagline}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close chat"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-fg/10 text-fg/60 transition-colors duration-150 ease-out hover:text-fg"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </header>

            <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4" aria-live="polite" aria-busy={isSending}>
              <div className={`flex items-end gap-2 ${ENTER}`}>
                <Avatar />
                <div className="rounded-2xl rounded-bl-md border border-fg/10 bg-surface px-3.5 py-3">
                  <p className="text-sm font-semibold text-fg">{greeting.title}</p>
                  <p className="mt-1 text-xs leading-5 text-fg/55">{greeting.body}</p>
                </div>
              </div>

              {turns.length === 0 ? (
                <div className="grid grid-cols-1 gap-2 pl-9">
                  {quickPrompts.map((prompt, index) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void submit(prompt)}
                      style={{ transitionDelay: `${80 + index * 40}ms` }}
                      className="flex items-center justify-between rounded-full border border-fg/10 bg-surface px-4 py-2.5 text-left text-xs text-fg/75 transition-[opacity,translate,border-color,color] duration-300 ease-out hover:border-mint/30 hover:text-fg starting:translate-y-2 starting:opacity-0"
                    >
                      {prompt}
                      <ChevronRight className="h-4 w-4 text-accent" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              ) : null}

              {turns.map((turn) =>
                turn.role === "user" ? (
                  <div key={turn.id} className={`ml-10 flex justify-end ${ENTER}`}>
                    <p className="whitespace-pre-wrap rounded-2xl rounded-br-md bg-mint px-3.5 py-2.5 text-sm leading-5 text-ink">{turn.content}</p>
                  </div>
                ) : (
                  <div key={turn.id} className={`mr-4 flex items-end gap-2 ${ENTER}`}>
                    <Avatar />
                    <p className="whitespace-pre-wrap rounded-2xl rounded-bl-md border border-fg/10 bg-surface px-3.5 py-2.5 text-sm leading-5 text-fg/80">{turn.content}</p>
                  </div>
                )
              )}

              {isSending ? (
                <div className="flex items-end gap-2 transition-[opacity,translate] duration-200 ease-out starting:translate-y-2 starting:opacity-0">
                  <Avatar />
                  <div className="rounded-2xl rounded-bl-md border border-fg/10 bg-surface px-3.5 py-3.5">
                    <span className="flex items-center gap-1" aria-label="Writing a reply">
                      {[0, 150, 300].map((delay) => (
                        <span key={delay} className="ww-typing-dot h-1.5 w-1.5 rounded-full bg-accent" style={{ animationDelay: `${delay}ms` }} />
                      ))}
                    </span>
                  </div>
                </div>
              ) : null}

              {error ? (
                <p role="alert" className="flex items-start gap-2 rounded-2xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-xs text-danger transition-[opacity,translate] duration-200 ease-out starting:-translate-y-1 starting:opacity-0">
                  <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {error}
                </p>
              ) : null}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
              className="border-t border-fg/[0.07] bg-canvas p-3 pb-[max(12px,env(safe-area-inset-bottom))]"
            >
              <div className="flex items-center gap-2 rounded-full border border-fg/10 bg-surface p-1.5 pl-3 transition-colors duration-150 ease-out focus-within:border-mint/40">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  maxLength={maxLength}
                  disabled={isSending}
                  placeholder={placeholder}
                  aria-label={`Message ${title}`}
                  className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-fg outline-none placeholder:text-fg/30 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isSending}
                  aria-label="Send message"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mint text-ink transition-[opacity,scale] duration-150 ease-out enabled:active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              {footer ? <p className="mt-1.5 text-center text-[11px] text-fg/50">{footer}</p> : null}
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
