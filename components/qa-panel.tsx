"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { subscribeToChatMessages } from "@/lib/realtime";
import type { ChatMessage, UserRole } from "@/types";

interface ChatMessageWithUser extends ChatMessage {
  USER: { full_name: string };
}

interface QAPanelProps {
  eventId: string;
  userRole: UserRole | null;
  eventStarted: boolean;
}

function groupMessages(messages: ChatMessageWithUser[]) {
  const questions: ChatMessageWithUser[] = [];
  const answersByParent = new Map<number, ChatMessageWithUser[]>();

  for (const msg of messages) {
    if (msg.reply_to) {
      const existing = answersByParent.get(msg.reply_to) ?? [];
      existing.push(msg);
      answersByParent.set(msg.reply_to, existing);
    } else {
      questions.push(msg);
    }
  }

  return { questions, answersByParent };
}

export default function QAPanel({ eventId, userRole, eventStarted }: QAPanelProps) {
  const [messages, setMessages] = useState<ChatMessageWithUser[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<number | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const canAnswer = userRole === "facilitator" || userRole === "speaker";
  const { questions, answersByParent } = groupMessages(messages);

  useEffect(() => {
    let ignore = false;
    fetch(`/api/chat/${eventId}?channel=live_qa&limit=50`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!ignore) setMessages(data.messages ?? []);
      })
      .catch(() => {
        if (!ignore) setError("Failed to load questions.");
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

  const handleAnswer = useCallback((questionId: number) => {
    setReplyTarget(questionId);
    inputRef.current?.focus();
  }, []);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || sending || !eventStarted) return;

    setSending(true);
    setError(null);
    const res = await fetch(`/api/chat/${eventId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: "live_qa",
        message: newMessage.trim(),
        reply_to: replyTarget ?? undefined,
      }),
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
    setReplyTarget(null);
    setSending(false);
  }

  async function handleMarkVerbal(questionId: number) {
    const res = await fetch(`/api/chat/${eventId}/${questionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answered_verbally: true }),
    });

    if (res.ok) {
      setMessages((prev) => prev.map((m) => (m.message_id === questionId ? { ...m, answered_verbally: true } : m)));
    }
  }

  function formatTime(sentAt: string) {
    return new Date(sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  if (!eventStarted) {
    return (
      <div className="flex h-full flex-col rounded-xl border border-[#bdc8d0] bg-white shadow-[0_4px_10px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between border-b border-[#bdc8d0] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-rounded text-lg text-[#00658d]">forum</span>
            <span className="text-sm font-semibold text-[#1b1c1c]">Q&A</span>
            <span className="material-symbols-rounded text-sm text-[#6E7980]">lock</span>
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <span className="material-symbols-rounded text-3xl text-[#6E7980]">lock</span>
          <p className="text-sm text-[#6E7980]">Q&A opens when the event starts.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-[#bdc8d0] bg-white shadow-[0_4px_10px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between border-b border-[#bdc8d0] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-lg text-[#00658d]">forum</span>
          <span className="text-sm font-semibold text-[#1b1c1c]">Q&A</span>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-sm text-[#6E7980]">Loading questions...</p>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-3">
            <div className="space-y-3">
              {questions.length === 0 && (
                <p className="py-8 text-center text-sm text-[#6E7980]">No questions yet. Be the first to ask!</p>
              )}
              {questions.map((q) => {
                const answers = answersByParent.get(q.message_id) ?? [];
                const isAnswered = answers.length > 0 || q.answered_verbally;

                return (
                  <div key={q.message_id}>
                    <div
                      className={`flex flex-col gap-1 rounded-lg border-l-4 bg-[#fbf9f8] p-3 shadow-[0_1px_1px_rgba(0,0,0,0.05)] ${
                        isAnswered ? "border-[#3db9ee]" : "border-[#6e7980]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="flex size-5 items-center justify-center overflow-hidden rounded-full bg-[#e4e2e1]">
                            <span className="material-symbols-rounded text-[10px] text-[#5f5e5e]">person</span>
                          </div>
                          <span className="text-[10px] font-bold text-[#1b1c1c]">{q.USER?.full_name ?? "Unknown"}</span>
                        </div>
                        <span className="text-[10px] text-[#5f5e5e]">{formatTime(q.sent_at)}</span>
                      </div>
                      <p className="text-sm leading-5 text-[#1b1c1c]">{q.message}</p>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {q.answered_verbally && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f5e9] px-2 py-0.5 text-[10px] font-semibold text-[#2e7d32]">
                            <span className="material-symbols-rounded text-xs">record_voice_over</span>
                            Answered verbally
                          </span>
                        )}
                        {canAnswer && !q.answered_verbally && (
                          <>
                            <button
                              onClick={() => handleAnswer(q.message_id)}
                              className="rounded border border-[#3db9ee] px-3 py-1 text-[10px] font-bold text-[#3db9ee] transition-colors hover:bg-[#3db9ee] hover:text-white"
                            >
                              Answer
                            </button>
                            <button
                              onClick={() => handleMarkVerbal(q.message_id)}
                              className="rounded border border-[#6e7980] px-3 py-1 text-[10px] font-bold text-[#6e7980] transition-colors hover:bg-[#6e7980] hover:text-white"
                            >
                              <span className="material-symbols-rounded text-xs align-middle">record_voice_over</span>
                              Spoken
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {answers.map((a) => (
                      <div
                        key={a.message_id}
                        className="ml-4 mt-2 flex flex-col gap-1 rounded-lg border-l-2 border-[#3db9ee] bg-white p-3 shadow-[0_1px_1px_rgba(0,0,0,0.05)]"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className="flex size-5 items-center justify-center overflow-hidden rounded-full bg-[#00658d]">
                              <span className="material-symbols-rounded text-[10px] text-white">support_agent</span>
                            </div>
                            <span className="text-[10px] font-bold text-[#00658d]">{a.USER?.full_name ?? "Unknown"}</span>
                          </div>
                          <span className="text-[10px] text-[#5f5e5e]">{formatTime(a.sent_at)}</span>
                        </div>
                        <p className="text-sm leading-5 text-[#1b1c1c]">{a.message}</p>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSend} className="border-t border-[#bdc8d0] p-3">
            {replyTarget && (
              <div className="mb-2 flex items-center justify-between rounded bg-[#e4e2e1] px-2 py-1">
                <span className="text-[10px] text-[#5f5e5e]">Replying to question...</span>
                <button type="button" onClick={() => setReplyTarget(null)} className="text-[10px] text-[#5f5e5e]">
                  <span className="material-symbols-rounded text-sm">close</span>
                </button>
              </div>
            )}
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
