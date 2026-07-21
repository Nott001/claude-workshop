"use client";

import { useEffect, useState, useRef } from "react";
import { subscribeToChatMessages } from "@/lib/realtime";
import type { ChatMessage, UserRole } from "@/types";

interface ChatMessageWithUser extends ChatMessage {
  USER: { full_name: string };
}

interface QAPanelProps {
  eventId: string;
  userRole: UserRole | null;
  currentUserId: number | null;
  eventStarted: boolean;
}

export default function QAPanel({ eventId, userRole, currentUserId, eventStarted }: QAPanelProps) {
  const [messages, setMessages] = useState<ChatMessageWithUser[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const canAnswer = userRole === "facilitator" || userRole === "speaker";

  useEffect(() => {
    let ignore = false;
    fetch(`/api/chat/${eventId}?channel=live_qa&limit=50`)
      .then((r) => r.json())
      .then((data) => {
        if (!ignore && data) {
          setMessages(data.messages ?? []);
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    const sub = subscribeToChatMessages(Number(eventId), "live_qa", (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.message_id === msg.message_id)) return prev;
        return [...prev, msg as ChatMessageWithUser];
      });
    });
    return () => sub.unsubscribe();
  }, [eventId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || sending || !eventStarted) return;

    setSending(true);
    setError(null);
    const res = await fetch(`/api/chat/${eventId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "live_qa", message: newMessage.trim() }),
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

    setNewMessage("");
    setSending(false);
  }

  function formatTime(sentAt: string) {
    return new Date(sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-[#bdc8d0] bg-white shadow-[0_4px_10px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between border-b border-[#bdc8d0] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-lg text-[#00658d]">forum</span>
          <span className="text-sm font-semibold text-[#1b1c1c]">Q&A</span>
          {!eventStarted && <span className="material-symbols-rounded text-sm text-[#6E7980]">lock</span>}
        </div>
      </div>

      {!eventStarted ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <span className="material-symbols-rounded text-3xl text-[#6E7980]">lock</span>
          <p className="text-sm text-[#6E7980]">Q&A opens when the event starts.</p>
        </div>
      ) : loading ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-sm text-[#6E7980]">Loading questions...</p>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-3">
            <div className="space-y-3">
              {messages.length === 0 && (
                <p className="py-8 text-center text-sm text-[#6E7980]">No questions yet. Be the first to ask!</p>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.message_id}
                  className="flex flex-col gap-1 rounded-lg border-l-4 border-[#6e7980] bg-[#fbf9f8] p-3 shadow-[0_1px_1px_rgba(0,0,0,0.05)]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="flex size-5 items-center justify-center overflow-hidden rounded-full bg-[#e4e2e1]">
                        <span className="material-symbols-rounded text-[10px] text-[#5f5e5e]">person</span>
                      </div>
                      <span className="text-[10px] font-bold text-[#1b1c1c]">{msg.USER?.full_name ?? "Unknown"}</span>
                    </div>
                    <span className="text-[10px] text-[#5f5e5e]">{formatTime(msg.sent_at)}</span>
                  </div>
                  <p className="text-sm leading-5 text-[#1b1c1c]">{msg.message}</p>
                  {canAnswer && msg.user_id !== currentUserId && (
                    <button
                      onClick={() => {
                        setNewMessage(`@${msg.USER?.full_name ?? "User"} `);
                        inputRef.current?.focus();
                      }}
                      className="self-start rounded border border-[#3db9ee] px-3 py-1 text-[10px] font-bold text-[#3db9ee] transition-colors hover:bg-[#3db9ee] hover:text-white"
                    >
                      Answer
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSend} className="border-t border-[#bdc8d0] p-3">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={canAnswer ? "Type your answer..." : "Ask a question..."}
                maxLength={1000}
                className="flex-1 rounded-lg border border-[#bdc8d0] px-3 py-2 text-sm outline-none focus:border-[#3db9ee]"
              />
              <button
                type="submit"
                disabled={sending || !newMessage.trim()}
                className="rounded-lg bg-[#3db9ee] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#039be5] disabled:opacity-50"
              >
                {sending ? "..." : "Send"}
              </button>
            </div>
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
          </form>
        </>
      )}
    </div>
  );
}
