"use client";

import { useState, useRef, useEffect } from "react";
import type { UserRole } from "@/shared/types";
import { isChatStaff, type ChatMessageWithUser } from "@/modules/chat/lib/types";
import { useRealtimeMessages, CHAT_TABLE } from "@/modules/chat/lib/use-realtime-messages";
import { MessageComposer } from "./message-composer";

interface ChatPanelProps {
  eventId: string;
  supportType: "general" | "event";
  userRole: UserRole | null;
  currentUserId: number | null;
}

export default function ChatPanel({ eventId, supportType, userRole, currentUserId }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessageWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const isStaff = isChatStaff(userRole);

  const apiUrl = supportType === "general" ? "/api/support" : `/api/support?support_type=event&event_id=${eventId}`;

  useEffect(() => {
    fetch(apiUrl)
      .then((res) => res.json())
      .then((data) => {
        setMessages(data.messages ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [apiUrl]);

  useRealtimeMessages<ChatMessageWithUser>({
    channelName: `chat-panel-${supportType}-${eventId}`,
    table: CHAT_TABLE,
    filter: `support_type=eq.${supportType}`,
    relevant: (row) => {
      if (supportType === "event" && row.event_id !== Number(eventId)) return false;
      if (supportType === "general" && row.event_id !== null) return false;
      return row.user_id === currentUserId || row.recipient_user_id === currentUserId || isStaff;
    },
    onInsert: (msg) =>
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      }),
  });

  useEffect(() => {
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
  };

  async function handleSend() {
    if (!newMessage.trim() || sending) return;

    const text = newMessage.trim();
    setSending(true);
    setError(null);

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        support_type: supportType,
        message: text,
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

  async function handleDelete(messageId: number) {
    const res = await fetch(`/api/support/${messageId}`, { method: "DELETE" });
    if (!res.ok) return;
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }

  function formatTime(sentAt: string) {
    return new Date(sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  if (loading) return <div>Loading messages...</div>;

  return (
    <div>
      <div ref={listRef} onScroll={handleScroll} style={{ maxHeight: "400px", overflowY: "auto" }}>
        {messages.length === 0 && <p>No messages yet.</p>}

        {messages.map((msg) => (
          <div key={msg.id}>
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

      <MessageComposer value={newMessage} onChange={setNewMessage} onSend={handleSend} sending={sending} error={error} />
    </div>
  );
}
