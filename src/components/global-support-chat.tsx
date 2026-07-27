"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { useCurrentUser } from "@/hooks/use-current-user";
import { subscribeToSupportSessions } from "@/lib/realtime";
import type { ChatMessage, UserRole } from "@/types";

interface ChatMessageWithUser extends ChatMessage {
  USER: { full_name: string; role: UserRole };
}

interface SupportData {
  messages: ChatMessageWithUser[];
  session_active: boolean;
}

interface GlobalSupportChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlobalSupportChat({ isOpen, onClose }: GlobalSupportChatProps) {
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState(true);
  const [pendingMessages, setPendingMessages] = useState<ChatMessageWithUser[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { user: currentUser } = useCurrentUser();
  const currentUserId = currentUser?.id ?? null;

  const pollIntervalRef = useRef(5000);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const prevLastMsgRef = useRef(0);

  function setActive() {
    pollIntervalRef.current = 2000;
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      pollIntervalRef.current = 5000;
    }, 30000);
  }

  const { data, isLoading } = useSWR<SupportData>("/api/support", fetcher, {
    refreshInterval: () => pollIntervalRef.current,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    keepPreviousData: true,
  });

  const serverMessages = data?.messages ?? [];
  const sessionActiveFromServer = data?.session_active ?? true;

  useEffect(() => {
    setSessionActive(sessionActiveFromServer);
  }, [sessionActiveFromServer]);

  useEffect(() => {
    if (data?.messages?.length) {
      const last = data.messages[data.messages.length - 1];
      if (last.id !== prevLastMsgRef.current) {
        prevLastMsgRef.current = last.id;
        setActive();
      }
    }
  }, [data]);

  const allMessages = useMemo(() => {
    const pendingIds = new Set(pendingMessages.map((m) => m.id));
    const merged = [...serverMessages];
    for (const p of pendingMessages) {
      if (!merged.some((m) => m.id === p.id)) {
        merged.push(p);
      }
    }
    return merged.sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());
  }, [serverMessages, pendingMessages]);

  useEffect(() => {
    const sub = subscribeToSupportSessions((session) => {
      setSessionActive(session.status === "active");
    });
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [allMessages, isOpen]);

  function formatTime(sentAt: string) {
    const d = new Date(sentAt);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || sending || currentUserId == null) return;

    const text = newMessage.trim();
    const optimisticId = -Date.now();
    const optimistic: ChatMessageWithUser = {
      id: optimisticId,
      channel: "global_support",
      user_id: currentUserId,
      message: text,
      sent_at: new Date().toISOString(),
      session_id: 0,
      recipient_user_id: null,
      reply_to: null,
      answered_verbally: false,
      deleted_at: null,
      updated_at: null,
      USER: { full_name: currentUser?.full_name ?? "You", role: (currentUser?.role ?? "attendee") as UserRole },
    };

    setPendingMessages((prev) => [...prev, optimistic]);
    setNewMessage("");
    setSending(true);
    setError(null);

    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    if (res.status === 429) {
      setPendingMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setError("Too many messages. Please wait a moment.");
      setSending(false);
      return;
    }

    if (!res.ok) {
      setPendingMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setError("Failed to send message.");
      setSending(false);
      return;
    }

    const sent = (await res.json()) as ChatMessageWithUser;
    setPendingMessages((prev) => prev.filter((m) => m.id !== optimisticId));
    setSending(false);
    setActive();
  }

  const chatEnded = !sessionActive && serverMessages.length > 0;

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
          <span className="text-sm font-semibold text-fg">Support</span>
          {!sessionActive && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-fg">Ended</span>
          )}
        </div>
        <button onClick={onClose} className="text-muted-fg transition-colors hover:text-fg">
          <span className="material-symbols-rounded text-lg">close</span>
        </button>
      </div>

      {isLoading ? (
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
              {allMessages.length === 0 && (
                <p className="py-12 text-center text-sm text-muted-fg">No messages yet. How can we help?</p>
              )}

              {allMessages.map((msg) => {
                const isChatEnded = msg.message.startsWith("[Chat ended");
                const isOwn = msg.user_id === currentUserId;
                const isStaff = msg.USER?.role === "facilitator";
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
