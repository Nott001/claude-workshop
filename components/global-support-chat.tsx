"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { subscribeToChatMessages } from "@/lib/realtime";
import type { ChatMessage, UserRole } from "@/types";

const POLL_INTERVAL = 3000;

interface ChatMessageWithUser extends ChatMessage {
  USER: { full_name: string; role: UserRole };
}

interface GlobalSupportChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlobalSupportChat({ isOpen, onClose }: GlobalSupportChatProps) {
  const [messages, setMessages] = useState<ChatMessageWithUser[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [ignoreChatEnded, setIgnoreChatEnded] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const lastSentAtRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let ignore = false;

    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!ignore && data) {
          setCurrentUserId(data.user_id);
        }
      });

    return () => {
      ignore = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) setIgnoreChatEnded(false);
  }, [isOpen]);

  const fetchMessages = useCallback(async (before?: string) => {
    const params = new URLSearchParams({ limit: "50" });
    if (before) params.set("before", before);

    const res = await fetch(`/api/support?${params}`);
    if (!res.ok) return;
    const data = await res.json();
    return data as { messages: ChatMessageWithUser[]; nextCursor: string | null };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let ignore = false;

    fetch("/api/support?limit=50")
      .then((r) => r.json())
      .then((data) => {
        if (!ignore && data) {
          setMessages(data.messages ?? []);
          setNextCursor(data.nextCursor);
        }
      })
      .catch(() => {
        if (!ignore) setError("Failed to load messages.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const sub = subscribeToChatMessages(null, "global_support", (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.message_id === msg.message_id)) return prev;
        const next = [...prev, msg as ChatMessageWithUser];
        lastSentAtRef.current = next[next.length - 1].sent_at;
        return next;
      });
    });
    return () => sub.unsubscribe();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const id = setInterval(async () => {
      const after = lastSentAtRef.current;
      const params = new URLSearchParams({ limit: "10" });
      if (after) params.set("after", after);
      try {
        const res = await fetch(`/api/support?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data.messages?.length) return;
        setMessages((prev) => {
          const merged = [...prev];
          let changed = false;
          for (const m of data.messages as ChatMessageWithUser[]) {
            if (!merged.some((x) => x.message_id === m.message_id)) {
              merged.push(m);
              changed = true;
            }
          }
          if (changed && merged.length > 0) {
            lastSentAtRef.current = merged[merged.length - 1].sent_at;
          }
          return changed ? merged : prev;
        });
      } catch {}
    }, POLL_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isOpen]);

  useEffect(() => {
    if (messages.length > 0) {
      lastSentAtRef.current = messages[messages.length - 1].sent_at;
    }
  }, [messages]);

  useEffect(() => {
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const data = await fetchMessages(nextCursor);
    if (data) {
      setMessages((prev) => [...data!.messages, ...prev]);
      setNextCursor(data.nextCursor);
    }
    setLoadingMore(false);
  }, [nextCursor, loadingMore, fetchMessages]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const threshold = 50;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  };

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    setError(null);
    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: newMessage.trim() }),
    });

    if (res.status === 429) {
      setError("Too many messages. Please wait a moment.");
      setSending(false);
      return;
    }

    if (!res.ok) {
      setError("Failed to send message.");
      setSending(false);
      return;
    }

    const sent = await res.json();
    setMessages((prev) => {
      if (prev.some((m) => m.message_id === sent.message_id)) return prev;
      const next = [...prev, sent as ChatMessageWithUser];
      lastSentAtRef.current = next[next.length - 1].sent_at;
      return next;
    });

    setNewMessage("");
    setSending(false);
  }

  function formatTime(sentAt: string) {
    const d = new Date(sentAt);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const chatEnded = !ignoreChatEnded && messages.length > 0 && messages[messages.length - 1].message.startsWith("[Chat ended");

  function handleStartNew() {
    setMessages([]);
    setNextCursor(null);
    lastSentAtRef.current = new Date().toISOString();
    setIgnoreChatEnded(true);
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed bottom-24 right-8 z-50 flex w-[350px] flex-col rounded-xl border border-[#E8ECEF] bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
      style={{ height: "500px" }}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-[#E8ECEF] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-lg text-[#00658d]">support_agent</span>
          <span className="text-sm font-semibold text-[#1b1c1c]">Support</span>
        </div>
        <button onClick={onClose} className="text-[#8B989E] transition-colors hover:text-[#1b1c1c]">
          <span className="material-symbols-rounded text-lg">close</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="flex items-center gap-2">
            <div className="size-3 animate-spin rounded-full border-2 border-[#3db9ee] border-t-transparent" />
            <p className="text-sm text-[#6E7980]">Loading messages...</p>
          </div>
        </div>
      ) : (
        <>
          <div ref={listRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 min-h-0">
            <div className="space-y-3">
              {nextCursor && (
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="w-full text-xs text-[#3db9ee] hover:underline disabled:opacity-50"
                >
                  {loadingMore ? "Loading..." : "Load older messages"}
                </button>
              )}

              {messages.length === 0 && (
                <p className="py-12 text-center text-sm text-[#8B989E]">No messages yet. How can we help?</p>
              )}

              {messages.map((msg) => {
                const isChatEnded = msg.message.startsWith("[Chat ended");
                const isOwn = msg.user_id === currentUserId;
                const isStaff = msg.USER?.role === "facilitator";
                if (isChatEnded) {
                  return (
                    <div key={msg.message_id} className="flex items-center justify-center gap-1.5 py-3">
                      <span className="material-symbols-rounded text-sm text-[#8B989E]">call_end</span>
                      <span className="text-[11px] text-[#8B989E]">This conversation has ended.</span>
                    </div>
                  );
                }
                return (
                  <div key={msg.message_id} className={"flex flex-col " + (isOwn ? "items-end" : "items-start")}>
                    <div className="flex items-center gap-1.5 mb-1">
                      {isStaff && (
                        <span className="inline-flex items-center gap-1 rounded bg-[#e3f2fd] px-1.5 py-0.5 text-[9px] font-bold text-[#00658d]">
                          <span className="material-symbols-rounded text-[10px]">support_agent</span>
                          Staff
                        </span>
                      )}
                      <span className="text-[10px] text-[#8B989E]">{formatTime(msg.sent_at)}</span>
                    </div>
                    <div
                      className={
                        "max-w-[80%] rounded-xl px-3 py-2 text-sm " +
                        (isOwn
                          ? "bg-[#3db9ee] text-white"
                          : isStaff
                            ? "bg-[#e3f2fd] text-[#1b1c1c]"
                            : "bg-[#F0F2F4] text-[#1b1c1c]")
                      }
                    >
                      {msg.message}
                    </div>
                  </div>
                );
              })}
            </div>
            <div ref={bottomRef} />
          </div>

          {chatEnded ? (
            <div className="shrink-0 border-t border-[#E8ECEF] px-4 py-3">
              <button
                onClick={handleStartNew}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#DDE3E7] py-3 text-[11px] text-[#00658d] transition-colors hover:bg-[#F0F2F4]"
              >
                <span className="material-symbols-rounded text-sm">add_comment</span>
                Start a new conversation
              </button>
            </div>
          ) : (
            <form onSubmit={handleSend} className="shrink-0 border-t border-[#E8ECEF] px-4 py-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  maxLength={1000}
                  className="min-w-0 flex-1 rounded-lg border border-[#DDE3E7] px-3 py-2 text-sm text-[#1b1c1c] outline-none placeholder:text-[#8B989E] focus:border-[#3db9ee] focus:ring-2 focus:ring-[#3db9ee]/20"
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="flex items-center gap-1 rounded-lg bg-[#3db9ee] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#039be5] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? (
                    <div className="size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <span className="material-symbols-rounded text-sm">send</span>
                  )}
                </button>
              </div>
              {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
            </form>
          )}
        </>
      )}
    </div>
  );
}
