"use client";

import { useEffect, useState, useRef } from "react";
import type { UserRole } from "@/shared/types";
import { isChatStaff } from "@/shared/lib/is-chat-staff";
import type { QaMessageWithUser } from "@/modules/courses/qa/lib/types";
import { subscribeToQaMessagesByModule } from "@/modules/courses/qa/lib/realtime";
import { unsubscribe } from "@/shared/integrations/realtime";
import { MessageComposer } from "@/shared/components/message-composer";

interface QAPanelProps {
  moduleId: number;
  userRole: UserRole | null;
  isSpeakerAssigned: boolean;
  eventStarted: boolean;
  eventEnded: boolean;
  isLocked: boolean;
  onToggleLock: () => void;
}

export default function QAPanel({
  moduleId,
  userRole,
  isSpeakerAssigned,
  eventStarted,
  eventEnded,
  isLocked,
  onToggleLock,
}: QAPanelProps) {
  const [messages, setMessages] = useState<QaMessageWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  const isStaff = isChatStaff(userRole);
  // The server admits admins, facilitators and assigned speakers (course team);
  // the client floor mirrors that so the delete/lock controls do not hide work
  // the API would allow, or promise work it would refuse for unassigned staff.
  const canModerate = isStaff || isSpeakerAssigned;

  useEffect(() => {
    fetch(`/api/qa/module/${moduleId}`)
      .then((res) => res.json())
      .then((data) => {
        setMessages(data.messages ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [moduleId]);

  useEffect(() => {
    // Realtime INSERT payloads carry no joined author row, so the panel refetches
    // the question through the DAO-backed GET route, exactly as the chat hook's
    // enrichment did — the browser never queries the database under the anon key.
    const sub = subscribeToQaMessagesByModule(moduleId, {
      onInsert: async (msg) => {
        try {
          const res = await fetch(`/api/qa/message/${msg.id}`);
          if (!res.ok) return;
          const full = (await res.json()) as QaMessageWithUser | null;
          if (!full) return;
          setMessages((prev) => {
            if (prev.some((m) => m.id === full.id)) return prev;
            return [...prev, full];
          });
        } catch {
          // A failed enrichment fetch drops the row until the next REST load.
        }
      },
      onUpdate: (msg) => setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m))),
      onDelete: (msg) => setMessages((prev) => prev.filter((m) => m.id !== msg.id)),
    });

    return () => unsubscribe(sub);
  }, [moduleId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
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
        {canModerate && (
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
                  {canModerate && (
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
            <MessageComposer
              value={newMessage}
              onChange={setNewMessage}
              onSend={handleSend}
              sending={sending}
              error={error}
              placeholder="Ask a question..."
            />
          )}
        </>
      )}
    </div>
  );
}
