"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { getBrowserClient } from "@/shared/db/browser-client";
import type { QaMessage, UserRole } from "@/shared/types";
import { hasMinRole } from "@/shared/lib/role-hierarchy";

interface QaMessageWithUser extends QaMessage {
  USER: { full_name: string; role: UserRole };
}

interface QAPanelProps {
  moduleId: number;
  userRole: UserRole | null;
  eventStarted: boolean;
  eventEnded: boolean;
  isLocked: boolean;
  onToggleLock: () => void;
}

export default function QAPanel({ moduleId, userRole, eventStarted, eventEnded, isLocked, onToggleLock }: QAPanelProps) {
  const [messages, setMessages] = useState<QaMessageWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => getBrowserClient(), []);

  const isStaff = hasMinRole(userRole, "speaker");

  useEffect(() => {
    fetch(`/api/qa/module/${moduleId}`)
      .then((res) => res.json())
      .then((data) => {
        setMessages(data.messages ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    const channelName = `qa-module-${moduleId}-${Date.now()}`;
    const sub = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "QA_MESSAGE",
          filter: `module_id=eq.${moduleId}`,
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const { data: full } = await supabase
              .from("QA_MESSAGE")
              .select("*, USER:user_id(full_name, role)")
              .eq("id", (payload.new as QaMessage).id)
              .single();
            if (full) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === full.id)) return prev;
                return [...prev, full as unknown as QaMessageWithUser];
              });
            }
          } else if (payload.eventType === "UPDATE") {
            setMessages((prev) =>
              prev.map((m) => (m.id === (payload.new as QaMessage).id ? { ...m, ...(payload.new as Partial<QaMessage>) } : m)),
            );
          } else if (payload.eventType === "DELETE") {
            setMessages((prev) => prev.filter((m) => m.id !== (payload.old as QaMessage).id));
          }
        },
      )
      .subscribe();

    return () => {
      sub.unsubscribe();
    };
  }, [moduleId, supabase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || sending || !eventStarted || isLocked) return;

    const text = newMessage.trim();
    setSending(true);
    setError(null);

    const res = await fetch(`/api/qa/module/${moduleId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, module_id: moduleId }),
    });

    if (res.status === 429) {
      setError("Too many messages. Please wait a moment.");
    } else if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Failed to send message.");
    }
    setNewMessage("");
    setSending(false);
  }

  async function handleDelete(messageId: number) {
    await fetch(`/api/qa/message/${messageId}`, { method: "DELETE" });
  }

  function formatDateTime(sentAt: string) {
    const d = new Date(sentAt);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (isToday) return time;
    return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
  }

  const sortedMessages = [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return (
    <div className="flex flex-col rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-lg text-brand">forum</span>
          <span className="text-sm font-semibold text-fg">Q&A</span>
          {sortedMessages.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-fg">
              {sortedMessages.length}
            </span>
          )}
        </div>
        {isStaff && (
          <button
            onClick={onToggleLock}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold transition-colors ${
              isLocked
                ? "border border-error/30 text-error hover:bg-error/10"
                : "border border-success/30 text-success hover:bg-success/10"
            }`}
          >
            <span className="material-symbols-rounded text-xs">{isLocked ? "lock" : "lock_open"}</span>
            {isLocked ? "Unlock" : "Locked"}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="flex items-center gap-2">
            <div className="size-3 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            <p className="text-sm text-muted-fg">Loading questions...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto min-h-0 max-h-60 p-4">
            <div className="space-y-3">
              {sortedMessages.length === 0 && <p className="py-12 text-center text-sm text-muted-fg">No questions yet.</p>}
              {sortedMessages.map((msg) => (
                <div key={msg.id} className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <div className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                        <span className="material-symbols-rounded text-[8px] text-muted-fg">person</span>
                      </div>
                      <span className="truncate text-[10px] font-semibold text-fg">{msg.USER?.full_name ?? "Unknown"}</span>
                    </div>
                    <span className="mt-0.5 shrink-0 whitespace-nowrap text-[10px] text-muted-fg">
                      {formatDateTime(msg.created_at)}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-fg">{msg.message}</p>
                  {isStaff && (
                    <button
                      onClick={() => handleDelete(msg.id)}
                      className="ml-auto flex items-center gap-1 rounded-lg border border-error/30 px-1.5 py-0.5 text-[10px] font-bold text-error transition-colors hover:bg-error/10"
                    >
                      <span className="material-symbols-rounded text-xs">delete</span>
                    </button>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </div>

          {!eventStarted ? (
            <div className="shrink-0 border-t border-border px-4 py-3 text-center">
              <p className="flex items-center justify-center gap-1.5 text-[10px] text-muted-fg">
                <span className="material-symbols-rounded text-xs">lock</span>
                Q&A opens when the event starts.
              </p>
            </div>
          ) : isLocked ? (
            <div className="shrink-0 border-t border-border px-4 py-3 text-center">
              <p className="flex items-center justify-center gap-1.5 text-[10px] text-muted-fg">
                <span className="material-symbols-rounded text-xs">lock</span>
                Q&A is locked by the speaker.
              </p>
            </div>
          ) : eventEnded ? (
            <div className="shrink-0 border-t border-border px-4 py-3 text-center">
              <p className="flex items-center justify-center gap-1.5 text-[10px] text-muted-fg">
                <span className="material-symbols-rounded text-xs">info</span>
                This event has ended. Q&A is in view-only mode.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSend} className="shrink-0 border-t border-border px-4 py-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Ask a question..."
                  maxLength={1000}
                  className="min-w-0 flex-1 rounded-lg border border-border px-3 py-2 text-sm text-fg outline-none placeholder:text-muted-fg focus:border-brand focus:ring-2 focus:ring-ring/20"
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand/80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? (
                    <div className="size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <span className="material-symbols-rounded text-sm">send</span>
                      Send
                    </>
                  )}
                </button>
              </div>
              {error && <p className="mt-1.5 text-xs text-error">{error}</p>}
            </form>
          )}
        </>
      )}
    </div>
  );
}
