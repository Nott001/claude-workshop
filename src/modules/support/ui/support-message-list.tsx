"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage, UserRole } from "@/types";

interface ChatMessageWithUser extends ChatMessage {
  USER: { full_name: string; role: UserRole };
}

interface SupportMessageListProps {
  messages: ChatMessageWithUser[];
  currentUserId: number | null;
  loading: boolean;
}

function formatTime(sentAt: string) {
  const d = new Date(sentAt);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function SupportMessageList({ messages, currentUserId, loading }: SupportMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (loading && messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="flex items-center gap-2">
          <div className="size-3 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <p className="text-sm text-muted-fg">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 min-h-0">
      <div className="mx-auto max-w-2xl space-y-3">
        {messages.length === 0 && <p className="py-12 text-center text-sm text-muted-fg">No messages yet.</p>}

        {messages.map((msg) => {
          const isChatEnded = msg.message.startsWith("[Chat ended");
          if (isChatEnded) {
            return (
              <div key={msg.id} className="flex items-center justify-center gap-1.5 py-3">
                <span className="material-symbols-rounded text-sm text-muted-fg">call_end</span>
                <span className="text-[11px] text-muted-fg">This conversation has ended.</span>
              </div>
            );
          }
          const isOwn = msg.user_id === currentUserId;
          const isStaff = msg.USER?.role === "facilitator";
          return (
            <div key={msg.id} className={"flex flex-col " + (isOwn ? "items-end" : "items-start")}>
              <div className="flex items-center gap-1.5 mb-1">
                {!isOwn && <span className="text-[10px] font-semibold text-fg">{msg.USER?.full_name ?? "Unknown"}</span>}
                {isStaff && (
                  <span className="inline-flex items-center gap-1 rounded bg-info/10 px-1.5 py-0.5 text-[9px] font-bold text-brand">
                    Staff
                  </span>
                )}
                <span className="text-[10px] text-muted-fg">{formatTime(msg.sent_at)}</span>
              </div>
              <div
                className={
                  "max-w-[80%] rounded-xl px-3 py-2 text-sm " +
                  (isOwn ? "bg-brand text-white" : isStaff ? "bg-info/10 text-fg" : "bg-surface text-fg shadow-sm")
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
  );
}
