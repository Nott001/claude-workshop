"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/shared/db/client";
import type { ChatMessage } from "@/shared/types";

interface ChatMessageWithUser extends ChatMessage {
  USER: { full_name: string };
}

interface ChatPanelProps {
  eventId: string;
  supportType: "general" | "event";
  userRole: string | null;
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

  const isStaff = userRole === "facilitator" || userRole === "admin" || userRole === "super_admin";

  const apiUrl = supportType === "general" ? "/api/support" : `/api/support?support_type=event&event_id=${eventId}`;

  useEffect(() => {
    fetch(apiUrl)
      .then((res) => res.json())
      .then((data) => {
        setMessages(data.messages ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    const channelName = `chat-panel-${supportType}-${eventId}-${Date.now()}`;
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
          if (supportType === "event" && msg.event_id !== Number(eventId)) return;
          if (supportType === "general" && msg.event_id !== null) return;
          if (msg.user_id === currentUserId || msg.recipient_user_id === currentUserId || isStaff) {
            const { data: full } = await supabase
              .from("CHAT_MESSAGE")
              .select("*, USER:user_id(full_name, role)")
              .eq("id", msg.id)
              .single();
            if (full) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === full.id)) return prev;
                return [...prev, full as unknown as ChatMessageWithUser];
              });
            }
          }
        },
      )
      .subscribe();

    return () => {
      sub.unsubscribe();
    };
  }, [eventId, supportType, currentUserId, isStaff]);

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

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
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
