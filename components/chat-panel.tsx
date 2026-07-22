"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import type { ChatMessage, UserRole } from "@/types";

interface ChatMessageWithUser extends ChatMessage {
  USER: { full_name: string };
}

interface ChatPanelProps {
  eventId: string;
  channel: "support" | "live_qa";
  userRole: UserRole | null;
  currentUserId: number | null;
}

export default function ChatPanel({ eventId, channel, userRole, currentUserId }: ChatPanelProps) {
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingMessages, setPendingMessages] = useState<ChatMessageWithUser[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const pollIntervalRef = useRef(5000);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const prevLastMsgRef = useRef(0);

  const isStaff = userRole === "facilitator" || userRole === "speaker";

  function setActive() {
    pollIntervalRef.current = 2000;
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      pollIntervalRef.current = 5000;
    }, 30000);
  }

  const { data, isLoading } = useSWR(`/api/chat/${eventId}?channel=${channel}&limit=50`, fetcher, {
    refreshInterval: () => pollIntervalRef.current,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    keepPreviousData: true,
  });

  const serverMessages = data?.messages ?? [];

  useEffect(() => {
    if (data?.messages?.length) {
      const last = data.messages[data.messages.length - 1];
      if (last.message_id !== prevLastMsgRef.current) {
        prevLastMsgRef.current = last.message_id;
        setActive();
      }
    }
  }, [data]);

  const allMessages = useMemo(() => {
    const merged = [...serverMessages];
    for (const p of pendingMessages) {
      if (!merged.some((m) => m.message_id === p.message_id)) {
        merged.push(p);
      }
    }
    return merged;
  }, [serverMessages, pendingMessages]);

  useEffect(() => {
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [allMessages]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const threshold = 50;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  };

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const text = newMessage.trim();
    const optimisticId = -Date.now();
    const optimistic: ChatMessageWithUser = {
      message_id: optimisticId,
      channel,
      user_id: currentUserId ?? 0,
      message: text,
      event_id: Number(eventId),
      sent_at: new Date().toISOString(),
      session_id: null,
      recipient_user_id: null,
      reply_to: null,
      answered_verbally: false,
      deleted_at: null,
      updated_at: null,
      USER: { full_name: "You" },
    };

    setPendingMessages((prev) => [...prev, optimistic]);
    setNewMessage("");
    setSending(true);
    setError(null);

    const res = await fetch(`/api/chat/${eventId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, message: text }),
    });

    if (res.status === 429) {
      setPendingMessages((prev) => prev.filter((m) => m.message_id !== optimisticId));
      setError("Too many messages. Please wait a moment.");
      setSending(false);
      return;
    }

    if (!res.ok) {
      setPendingMessages((prev) => prev.filter((m) => m.message_id !== optimisticId));
      setError("Failed to send message.");
      setSending(false);
      return;
    }

    const sent = (await res.json()) as ChatMessageWithUser;
    setPendingMessages((prev) => prev.filter((m) => m.message_id !== optimisticId));
    setSending(false);
    setActive();
  }

  async function handleDelete(messageId: number) {
    const res = await fetch(`/api/chat/${eventId}/${messageId}`, { method: "DELETE" });
    if (!res.ok) return;
  }

  function formatTime(sentAt: string) {
    const d = new Date(sentAt);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  if (isLoading) return <div>Loading messages...</div>;

  return (
    <div>
      <div ref={listRef} onScroll={handleScroll} style={{ maxHeight: "400px", overflowY: "auto" }}>
        {allMessages.length === 0 && <p>No messages yet.</p>}

        {allMessages.map((msg) => (
          <div key={msg.message_id} data-own={msg.user_id === currentUserId || undefined}>
            <div>
              <strong>{msg.USER?.full_name ?? "Unknown"}</strong>
              <span>{formatTime(msg.sent_at)}</span>
            </div>
            <p>{msg.message}</p>
            {isStaff && <button onClick={() => handleDelete(msg.message_id)}>Delete</button>}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          maxLength={1000}
        />
        <button type="submit" disabled={sending || !newMessage.trim()}>
          {sending ? "Sending..." : "Send"}
        </button>
      </form>

      {error && <p>{error}</p>}
    </div>
  );
}
