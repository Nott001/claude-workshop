"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { subscribeToChatMessages } from "@/lib/realtime";
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
  const [messages, setMessages] = useState<ChatMessageWithUser[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const isFacilitator = userRole === "facilitator";

  const fetchMessages = useCallback(
    async (before?: string) => {
      const params = new URLSearchParams({ channel, limit: "50" });
      if (before) params.set("before", before);

      const res = await fetch(`/api/chat/${eventId}?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      return data as { messages: ChatMessageWithUser[]; nextCursor: string | null };
    },
    [eventId, channel],
  );

  useEffect(() => {
    let ignore = false;

    const params = new URLSearchParams({ channel, limit: "50" });
    fetch(`/api/chat/${eventId}?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!ignore && data) {
          setMessages(data.messages);
          setNextCursor(data.nextCursor);
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [eventId, channel]);

  const scrollToBottom = () => {
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!eventId) return;

    const sub = subscribeToChatMessages(Number(eventId), channel, (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.message_id === msg.message_id)) return prev;
        return [...prev, msg as ChatMessageWithUser];
      });
    });

    return () => {
      sub.unsubscribe();
    };
  }, [eventId, channel]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const data = await fetchMessages(nextCursor);
    if (data) {
      setMessages((prev) => [...prev, ...data.messages]);
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
    const res = await fetch(`/api/chat/${eventId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, message: newMessage.trim() }),
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

  async function handleDelete(messageId: number) {
    const res = await fetch(`/api/chat/${eventId}/${messageId}`, { method: "DELETE" });
    if (!res.ok) return;
    setMessages((prev) => prev.filter((m) => m.message_id !== messageId));
  }

  function formatTime(sentAt: string) {
    const d = new Date(sentAt);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  if (loading) return <div>Loading messages...</div>;

  return (
    <div>
      <div ref={listRef} onScroll={handleScroll} style={{ maxHeight: "400px", overflowY: "auto" }}>
        {nextCursor && (
          <button onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading..." : "Load older messages"}
          </button>
        )}

        {messages.length === 0 && <p>No messages yet.</p>}

        {messages.map((msg) => (
          <div key={msg.message_id} data-own={msg.user_id === currentUserId || undefined}>
            <div>
              <strong>{msg.USER?.full_name ?? "Unknown"}</strong>
              <span>{formatTime(msg.sent_at)}</span>
            </div>
            <p>{msg.message}</p>
            {isFacilitator && <button onClick={() => handleDelete(msg.message_id)}>Delete</button>}
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
