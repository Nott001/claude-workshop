"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { subscribeToChatMessages } from "@/lib/realtime";
import type { ChatMessage, UserRole } from "@/types";

const POLL_INTERVAL = 3000;

interface ChatMessageWithUser extends ChatMessage {
  USER: { full_name: string; role: UserRole };
}

interface QAPanelProps {
  eventId: string;
  userRole: UserRole | null;
  currentUserId: number | null;
  eventStarted: boolean;
  eventEnded: boolean;
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

export default function QAPanel({ eventId, userRole, currentUserId, eventStarted, eventEnded }: QAPanelProps) {
  const [messages, setMessages] = useState<ChatMessageWithUser[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<number | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSentAtRef = useRef<string | null>(null);

  const isStaff = userRole === "facilitator" || userRole === "speaker";
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
        const next = [...prev, msg as ChatMessageWithUser];
        lastSentAtRef.current = next[next.length - 1].sent_at;
        return next;
      });
    });
    return () => sub.unsubscribe();
  }, [eventId]);

  useEffect(() => {
    if (!eventStarted) return;
    let cancelled = false;
    const id = setInterval(async () => {
      const after = lastSentAtRef.current;
      const params = new URLSearchParams({ channel: "live_qa", limit: "10" });
      if (after) params.set("after", after);
      try {
        const res = await fetch(`/api/chat/${eventId}?${params}`);
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
  }, [eventId, eventStarted]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (messages.length > 0) {
      lastSentAtRef.current = messages[messages.length - 1].sent_at;
    }
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

    const sent = await res.json();
    setMessages((prev) => {
      if (prev.some((m) => m.message_id === sent.message_id)) return prev;
      const next = [...prev, sent as ChatMessageWithUser];
      lastSentAtRef.current = next[next.length - 1].sent_at;
      return next;
    });

    setNewMessage("");
    setReplyTarget(null);
    setSending(false);
  }

  async function handleDelete(messageId: number) {
    const res = await fetch(`/api/chat/${eventId}/${messageId}`, { method: "DELETE" });
    if (!res.ok) return;
    setMessages((prev) => prev.filter((m) => m.message_id !== messageId));
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

  function formatDateTime(sentAt: string) {
    const d = new Date(sentAt);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (isToday) return time;
    return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
  }

  function userBadge(msg: ChatMessageWithUser) {
    if (msg.USER?.role === "speaker") {
      return (
        <span className="inline-flex shrink-0 items-center gap-1 rounded bg-[#fff3e0] px-1.5 py-0.5 text-[9px] font-bold text-[#e65100]">
          <span className="material-symbols-rounded text-[10px]">mic</span>
          Speaker
        </span>
      );
    }

    if (msg.USER?.role === "facilitator") {
      return (
        <span className="inline-flex shrink-0 items-center gap-1 rounded bg-[#e3f2fd] px-1.5 py-0.5 text-[9px] font-bold text-[#00658d]">
          <span className="material-symbols-rounded text-[10px]">support_agent</span>
          Staff
        </span>
      );
    }

    return null;
  }

  if (!eventStarted) {
    return (
      <div className="flex h-full flex-col rounded-xl border border-[#E8ECEF] bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#E8ECEF] px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-rounded text-lg text-[#00658d]">forum</span>
            <span className="text-sm font-semibold text-[#1b1c1c]">Q&A</span>
            <span className="material-symbols-rounded text-sm text-[#8B989E]">lock</span>
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <span className="material-symbols-rounded text-3xl text-[#8B989E]">lock</span>
          <p className="text-sm text-[#6E7980]">Q&A opens when the event starts.</p>
        </div>
      </div>
    );
  }

  const interactive = !eventEnded;

  return (
    <div className="flex h-full flex-col rounded-xl border border-[#E8ECEF] bg-white shadow-sm overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-[#E8ECEF] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-lg text-[#00658d]">forum</span>
          <span className="text-sm font-semibold text-[#1b1c1c]">Q&A</span>
          {questions.length > 0 && (
            <span className="rounded-full bg-[#E8ECEF] px-1.5 py-0.5 text-[10px] font-medium text-[#6E7980]">
              {questions.length}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="flex items-center gap-2">
            <div className="size-3 animate-spin rounded-full border-2 border-[#3db9ee] border-t-transparent" />
            <p className="text-sm text-[#6E7980]">Loading questions...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            <div className="space-y-3">
              {questions.length === 0 && (
                <p className="py-12 text-center text-sm text-[#8B989E]">No questions yet. Be the first to ask!</p>
              )}
              {questions.map((q) => {
                const answers = answersByParent.get(q.message_id) ?? [];
                const isAnswered = answers.length > 0 || q.answered_verbally;
                const isSpeaker = q.USER?.role === "speaker";

                return (
                  <div key={q.message_id}>
                    <div
                      className={
                        "flex flex-col gap-2 rounded-xl border bg-white p-4 shadow-sm " +
                        (isAnswered
                          ? "border-l-4 border-l-[#3db9ee] border-[#E8ECEF]"
                          : isSpeaker
                            ? "border-l-4 border-l-[#e65100] border-[#E8ECEF]"
                            : "border-[#E8ECEF]")
                      }
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E8ECEF]">
                            <span className="material-symbols-rounded text-xs text-[#6E7980]">person</span>
                          </div>
                          <div className="flex min-w-0 flex-col">
                            <span
                              className={"truncate text-xs font-semibold " + (isSpeaker ? "text-[#e65100]" : "text-[#1b1c1c]")}
                            >
                              {q.USER?.full_name ?? "Unknown"}
                            </span>
                            {userBadge(q)}
                          </div>
                        </div>
                        <span className="mt-0.5 shrink-0 whitespace-nowrap text-[10px] text-[#8B989E]">
                          {formatDateTime(q.sent_at)}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-[#1b1c1c]">{q.message}</p>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {q.answered_verbally && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f5e9] px-2 py-0.5 text-[10px] font-semibold text-[#2e7d32]">
                            <span className="material-symbols-rounded text-xs">record_voice_over</span>
                            Answered verbally
                          </span>
                        )}
                        {interactive && isStaff && currentUserId !== q.user_id && (
                          <button
                            onClick={() => handleAnswer(q.message_id)}
                            className="rounded-lg border border-[#3db9ee] px-2.5 py-1 text-[10px] font-bold text-[#3db9ee] transition-colors hover:bg-[#3db9ee] hover:text-white"
                          >
                            Answer
                          </button>
                        )}
                        {interactive && isStaff && !q.answered_verbally && currentUserId !== q.user_id && (
                          <button
                            onClick={() => handleMarkVerbal(q.message_id)}
                            className="flex items-center gap-1 rounded-lg border border-[#8B989E] px-2.5 py-1 text-[10px] font-bold text-[#6E7980] transition-colors hover:border-[#6E7980] hover:bg-[#6E7980] hover:text-white"
                          >
                            <span className="material-symbols-rounded text-xs">record_voice_over</span>
                            Spoken
                          </button>
                        )}
                        {interactive && isStaff && (
                          <button
                            onClick={() => handleDelete(q.message_id)}
                            className="ml-auto flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-[10px] font-bold text-red-500 transition-colors hover:bg-red-50"
                          >
                            <span className="material-symbols-rounded text-xs">delete</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {answers.map((a) => {
                      const isSpeaker = a.USER?.role === "speaker";
                      return (
                        <div
                          key={a.message_id}
                          className={
                            "ml-4 mt-2 flex flex-col gap-2 rounded-xl border bg-[#F8FAFB] p-3 shadow-sm " +
                            (isSpeaker
                              ? "border-l-2 border-l-[#e65100] border-[#E8ECEF]"
                              : "border-l-2 border-l-[#3db9ee] border-[#E8ECEF]")
                          }
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <div className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#00658d]">
                                <span className="material-symbols-rounded text-[8px] text-white">support_agent</span>
                              </div>
                              <div className="flex min-w-0 flex-col">
                                <span
                                  className={
                                    "truncate text-[10px] font-semibold " + (isSpeaker ? "text-[#e65100]" : "text-[#00658d]")
                                  }
                                >
                                  {a.USER?.full_name ?? "Unknown"}
                                </span>
                                {userBadge(a)}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {interactive && isStaff && (
                                <button
                                  onClick={() => handleDelete(a.message_id)}
                                  className="flex items-center gap-1 rounded-lg border border-red-200 px-1.5 py-0.5 text-[10px] font-bold text-red-500 transition-colors hover:bg-red-50"
                                >
                                  <span className="material-symbols-rounded text-xs">delete</span>
                                </button>
                              )}
                              <span className="mt-0.5 shrink-0 whitespace-nowrap text-[10px] text-[#8B989E]">
                                {formatDateTime(a.sent_at)}
                              </span>
                            </div>
                          </div>
                          <p className="text-sm leading-relaxed text-[#1b1c1c]">{a.message}</p>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <div ref={bottomRef} />
          </div>

          {interactive ? (
            <form onSubmit={handleSend} className="shrink-0 border-t border-[#E8ECEF] px-4 py-3">
              {replyTarget && (
                <div className="mb-2 flex items-center justify-between rounded-lg bg-[#3db9ee]/10 px-3 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-rounded text-xs text-[#3db9ee]">reply</span>
                    <span className="text-[10px] font-medium text-[#3db9ee]">Replying to a question</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyTarget(null)}
                    className="text-[#3db9ee] transition-colors hover:text-[#039be5]"
                  >
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
                  placeholder={isStaff ? "Type your answer..." : "Ask a question..."}
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
                    <>
                      <span className="material-symbols-rounded text-sm">send</span>
                      Send
                    </>
                  )}
                </button>
              </div>
              {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
            </form>
          ) : (
            <div className="shrink-0 border-t border-[#E8ECEF] px-4 py-3 text-center">
              <p className="flex items-center justify-center gap-1.5 text-[10px] text-[#8B989E]">
                <span className="material-symbols-rounded text-xs">info</span>
                This event has ended. Q&A is in view-only mode.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
