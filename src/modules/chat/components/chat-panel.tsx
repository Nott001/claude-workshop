"use client";

import { useState, useRef, useEffect } from "react";
import { useChatPolling } from "@/shared/lib/use-chat-polling";
import { useOptimisticMessages } from "@/shared/lib/use-optimistic-messages";
import type { ChatMessage, UserRole } from "@/shared/types";

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
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const isStaff = userRole === "facilitator" || userRole === "speaker";

  const { data, isLoading, setActive } = useChatPolling<{ messages: ChatMessageWithUser[] }>(
    `/api/chat/${eventId}?channel=${channel}&limit=50`,
  );

  const serverMessages = data?.messages ?? [];
  const { all: allMessages, addOptimistic, resolveOptimistic } = useOptimisticMessages<ChatMessageWithUser>(serverMessages);

  useEffect(() => {
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [allMessages]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
  };

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const text = newMessage.trim();
    const optimisticId = -Date.now();
    const optimistic: ChatMessageWithUser = {
      id: optimisticId,
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

    addOptimistic(optimistic);
    setNewMessage("");
    setSending(true);
    setError(null);

    const res = await fetch(`/api/chat/${eventId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, message: text }),
    });

    if (res.status === 429) {
      resolveOptimistic(optimisticId);
      setError("Too many messages. Please wait a moment.");
    } else if (!res.ok) {
      resolveOptimistic(optimisticId);
      setError("Failed to send message.");
    } else {
      await res.json();
      resolveOptimistic(optimisticId);
      setActive();
    }
    setSending(false);
  }

  async function handleDelete(messageId: number) {
    const res = await fetch(`/api/chat/${eventId}/${messageId}`, { method: "DELETE" });
    if (!res.ok) return;
  }

  function formatTime(sentAt: string) {
    return new Date(sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  if (isLoading) return <div>Loading messages...</div>;

  return (
    <div>
      <div ref={listRef} onScroll={handleScroll} style={{ maxHeight: "400px", overflowY: "auto" }}>
        {allMessages.length === 0 && <p>No messages yet.</p>}

        {allMessages.map((msg) => (
          <div key={msg.id} data-own={msg.user_id === currentUserId || undefined}>
            <div>
              <strong>{msg.USER?.full_name ?? "Unknown"}</strong>
              <span>{formatTime(msg.sent_at)}</span>
            </div>
            <p>{msg.message}</p>
            {isStaff && <button onClick={() => handleDelete(msg.id)}>Delete</button>}
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
