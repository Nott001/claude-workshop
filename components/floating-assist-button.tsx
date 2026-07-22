"use client";

import { useEffect, useState, useCallback } from "react";
import GlobalSupportChat from "@/components/global-support-chat";

const UNREAD_POLL_INTERVAL = 10000;
const STORAGE_KEY = "support_chat_last_read_at";

function getLastReadAt(): number {
  if (typeof window === "undefined") return 0;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? Number(stored) : 0;
}

function setLastReadAt(ts: number) {
  try { localStorage.setItem(STORAGE_KEY, String(ts)); } catch {}
}

export function FloatingAssistButton() {
  const [hovered, setHovered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const checkUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/support?limit=5");
      if (!res.ok) return;
      const data = await res.json();
      const lastReadAt = getLastReadAt();
      let count = 0;
      for (const msg of data.messages ?? []) {
        if (msg.USER?.role === "facilitator" && new Date(msg.sent_at).getTime() > lastReadAt) {
          count++;
        }
      }
      setUnreadCount(count);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkUnread();
    const id = setInterval(checkUnread, UNREAD_POLL_INTERVAL);
    return () => clearInterval(id);
  }, [checkUnread]);

  function handleOpen() {
    setLastReadAt(Date.now());
    setUnreadCount(0);
    setIsOpen(true);
  }

  function handleClose() {
    setLastReadAt(Date.now());
    setUnreadCount(0);
    setIsOpen(false);
  }

  return (
    <>
      <GlobalSupportChat isOpen={isOpen} onClose={handleClose} />
      <div
        className="fixed bottom-8 right-8 z-50 flex flex-col items-center gap-2"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          className={`whitespace-nowrap rounded-lg bg-white px-3 py-1.5 text-sm font-extralight text-[#1B1C1C] shadow-[0_4px_16px_rgba(0,0,0,0.15)] transition-opacity duration-200 ${
            hovered ? "opacity-100" : "opacity-0"
          }`}
        >
          Ask for assistance
        </div>
        <button
          onClick={isOpen ? handleClose : handleOpen}
          className="relative flex size-14 items-center justify-center rounded-full bg-[#3db9ee] shadow-[0_8px_10px_-6px_rgba(0,0,0,0.1),0_20px_25px_-5px_rgba(0,0,0,0.1)] transition-transform hover:scale-105"
          aria-label="Ask for assistance"
        >
          <span className="material-symbols-rounded text-[24px] text-[#00465F]">headset_mic</span>
          {!loading && unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </div>
    </>
  );
}
