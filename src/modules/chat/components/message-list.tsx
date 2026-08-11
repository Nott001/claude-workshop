"use client";

import { useEffect, useRef } from "react";
import type { ChatMessageWithUser } from "@/modules/chat/lib/types";

interface MessageListProps {
  messages: ChatMessageWithUser[];
  loading: boolean;
  currentUserId: number | null;
}

function formatTime(sentAt: string) {
  return new Date(sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessageList({ messages, loading, currentUserId }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-4">
      {loading ? (
        <p className="text-sm text-muted-fg">Loading messages...</p>
      ) : messages.length === 0 ? (
        <p className="text-sm text-muted-fg">No messages yet.</p>
      ) : (
        messages.map((msg) => {
          const isOwn = msg.user_id === currentUserId;
          return (
            <div key={msg.id} className={"flex flex-col " + (isOwn ? "items-end" : "items-start")}>
              <div className="mb-1 flex items-center gap-1.5">
                <span className="text-[10px] font-medium text-muted-fg">{msg.USER?.full_name ?? "Unknown"}</span>
                <span className="text-[10px] text-muted-fg">{formatTime(msg.sent_at)}</span>
              </div>
              <div
                className={"max-w-[80%] rounded-xl px-3 py-2 text-sm " + (isOwn ? "bg-brand text-white" : "bg-muted text-fg")}
              >
                {msg.message}
              </div>
            </div>
          );
        })
      )}
      <div ref={bottomRef} />
    </div>
  );
}
