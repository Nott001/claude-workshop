"use client";

import { useRef } from "react";
import type { ChatMessage } from "@/shared/types";

interface SupportChatClientProps {
  messages: ChatMessage[];
  currentUserId: number | null;
}

export function SupportChatClient({ messages, currentUserId }: SupportChatClientProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex h-full min-h-screen">
      <div className="flex w-[280px] flex-col border-r border-border bg-surface">
        <div className="flex shrink-0 items-center border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-fg">Support Inbox</span>
        </div>
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-xs text-muted-fg">Select a conversation</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col bg-muted">
        <div className="flex shrink-0 items-center border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-fg">Support Chat</span>
        </div>

        {messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-4">
            <p className="text-sm text-muted-fg">No messages yet.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4">
            {messages.map((msg) => (
              <div key={msg.id} className={"mb-2 flex " + (msg.user_id === currentUserId ? "justify-end" : "justify-start")}>
                <div
                  className={
                    "max-w-[70%] rounded-xl px-3 py-2 text-sm " +
                    (msg.user_id === currentUserId ? "bg-brand text-white" : "bg-surface text-fg")
                  }
                >
                  {msg.message}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}

        <div className="shrink-0 border-t border-border px-4 py-3">
          <input
            type="text"
            placeholder="Type a message..."
            disabled
            className="w-full rounded-lg border border-border px-3 py-2 text-sm opacity-50"
          />
        </div>
      </div>
    </div>
  );
}
