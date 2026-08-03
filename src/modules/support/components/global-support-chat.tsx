"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { getBrowserClient } from "@/shared/db/browser-client";
import { chatDao } from "@/shared/db/dao";
import { useSession } from "@/modules/auth";
import { subscribeToSupportSessions, unsubscribe } from "@/shared/integrations/realtime";
import type { ChatMessage, UserRole } from "@/shared/types";
import { hasMinRole } from "@/shared/lib/role-hierarchy";

interface ChatMessageWithUser extends ChatMessage {
  USER: { full_name: string; role: UserRole };
}

interface GlobalSupportChatProps {
  isOpen: boolean;
  onClose: () => void;
  supportType?: "general" | "event";
  eventId?: string;
}

export default function GlobalSupportChat({ isOpen, onClose, supportType = "general", eventId }: GlobalSupportChatProps) {
  const [messages, setMessages] = useState<ChatMessageWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => getBrowserClient(), []);

  const { user: currentUser } = useSession();
  const currentUserId = currentUser?.id ?? null;

  const apiUrl = supportType === "general" ? "/api/support" : `/api/support?support_type=event&event_id=${eventId}`;

  useEffect(() => {
    if (!isOpen) return;
    fetch(apiUrl)
      .then((res) => res.json())
      .then((data) => {
        setMessages(data.messages ?? []);
        setSessionActive(data.session_active ?? true);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    const channelName = `global-support-${supportType}-${eventId ?? "general"}-${Date.now()}`;
    const sub = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "CHAT_MESSAGE",
          filter: `support_type=eq.${supportType}`,
        },
        async (payload) => {
          const msg = payload.new as ChatMessageWithUser;
          if (supportType === "event" && eventId && msg.event_id !== Number(eventId)) return;
          if (supportType === "general" && msg.event_id !== null) return;
          const full = await chatDao.findMessageWithUser(supabase, msg.id);
          if (full) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === full.id)) return prev;
              return [...prev, full as unknown as ChatMessageWithUser];
            });
          }
        },
      )
      .subscribe();

    const sessionSub = subscribeToSupportSessions((session) => {
      setSessionActive(session.status === "active");
    });

    return () => {
      supabase.removeChannel(sub);
      unsubscribe(sessionSub);
    };
  }, [isOpen, supportType, eventId, supabase]);

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  function formatTime(sentAt: string) {
    return new Date(sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || sending || currentUserId == null) return;

    const text = newMessage.trim();
    setSending(true);
    setError(null);

    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        support_type: supportType,
        message: text,
        ...(supportType === "event" && eventId ? { event_id: Number(eventId) } : {}),
      }),
    });

    if (res.status === 429) {
      setError("Too many messages. Please wait a moment.");
    } else if (!res.ok) {
      setError("Failed to send message.");
    }
    setNewMessage("");
    setSending(false);
  }

  const chatEnded = !sessionActive && messages.length > 0;

  return (
    <div
      className={
        "fixed bottom-24 right-8 z-50 flex w-[350px] flex-col rounded-xl border border-border bg-surface shadow-[0_8px_30px_rgb(0,0,0,0.12)] " +
        (!isOpen ? "hidden" : "")
      }
      style={{ height: "500px" }}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-lg text-brand">support_agent</span>
          <span className="text-sm font-semibold text-fg">{supportType === "general" ? "Support" : "Event Support"}</span>
          {!sessionActive && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-fg">Ended</span>
          )}
        </div>
        <button onClick={onClose} className="text-muted-fg transition-colors hover:text-fg">
          <span className="material-symbols-rounded text-lg">close</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="flex items-center gap-2">
            <div className="size-3 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            <p className="text-sm text-muted-fg">Loading messages...</p>
          </div>
        </div>
      ) : (
        <>
          <div ref={bottomRef} className="flex-1 overflow-y-auto p-4 min-h-0">
            <div className="space-y-3">
              {messages.length === 0 && (
                <p className="py-12 text-center text-sm text-muted-fg">No messages yet. How can we help?</p>
              )}

              {messages.map((msg) => {
                const isChatEnded = msg.message.startsWith("[Chat ended");
                const isOwn = msg.user_id === currentUserId;
                const isStaff = hasMinRole(msg.USER?.role as UserRole, "facilitator");
                if (isChatEnded) {
                  return (
                    <div key={msg.id} className="flex items-center justify-center gap-1.5 py-3">
                      <span className="material-symbols-rounded text-sm text-muted-fg">call_end</span>
                      <span className="text-[11px] text-muted-fg">This conversation has ended.</span>
                    </div>
                  );
                }
                return (
                  <div key={msg.id} className={"flex flex-col " + (isOwn ? "items-end" : "items-start")}>
                    <div className="flex items-center gap-1.5 mb-1">
                      {isStaff && (
                        <span className="inline-flex items-center gap-1 rounded bg-info/10 px-1.5 py-0.5 text-[9px] font-bold text-brand">
                          <span className="material-symbols-rounded text-[10px]">support_agent</span>
                          Staff
                        </span>
                      )}
                      <span className="text-[10px] text-muted-fg">{formatTime(msg.sent_at)}</span>
                    </div>
                    <div
                      className={
                        "max-w-[80%] rounded-xl px-3 py-2 text-sm " +
                        (isOwn ? "bg-brand text-white" : isStaff ? "bg-info/10 text-fg" : "bg-muted text-fg")
                      }
                    >
                      {msg.message}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {chatEnded && (
            <div className="shrink-0 border-t border-border px-4 py-3">
              <p className="text-center text-[11px] text-muted-fg">
                This conversation has ended. Send a message to start a new one.
              </p>
            </div>
          )}

          <form onSubmit={handleSend} className="shrink-0 border-t border-border px-4 py-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
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
                  <span className="material-symbols-rounded text-sm">send</span>
                )}
              </button>
            </div>
            {error && <p className="mt-1.5 text-xs text-error">{error}</p>}
          </form>
        </>
      )}
    </div>
  );
}
