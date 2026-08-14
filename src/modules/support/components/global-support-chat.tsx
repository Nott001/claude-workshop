"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "@/modules/auth/components/session-context";
import { subscribeToSupportSessions, unsubscribe } from "@/shared/integrations/realtime";
import { isChatStaff } from "@/shared/lib/is-chat-staff";
import type { ChatMessageWithUser } from "@/modules/chat/lib/types";
import { useRealtimeMessages } from "@/modules/chat/lib/use-realtime-messages";
import { MessageComposer } from "@/shared/components/message-composer";
import { SignInPrompt } from "@/modules/support/components/sign-in-prompt";

interface GlobalSupportChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlobalSupportChat({ isOpen, onClose }: GlobalSupportChatProps) {
  const [messages, setMessages] = useState<ChatMessageWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState(true);
  const [sessionInfo, setSessionInfo] = useState<{
    case_number: number | null;
    assigned_to: number | null;
    assigned_staff_name: string | null;
  }>({ case_number: null, assigned_to: null, assigned_staff_name: null });
  const bottomRef = useRef<HTMLDivElement>(null);

  const { user, isLoaded } = useSession();
  const currentUserId = user?.id ?? null;

  const apiUrl = "/api/support";

  useEffect(() => {
    // Guests have no session, so `/api/support` answers 401 and there is
    // nothing to load or subscribe to. The `currentUserId` dep re-runs this
    // when a guest signs in with the panel open.
    if (!isOpen || currentUserId == null) return;

    let active = true;

    async function load(showSpinner = true) {
      if (showSpinner) setLoading(true);
      try {
        const res = await fetch(apiUrl);
        const data = await res.json();
        if (!active) return;
        setMessages(data.messages ?? []);
        setSessionActive(data.session_active ?? true);
        setSessionInfo({
          case_number: data.session?.case_number ?? null,
          assigned_to: data.session?.assigned_to ?? null,
          assigned_staff_name: data.session?.assigned_staff_name ?? null,
        });
      } catch {
        // A failed fetch keeps whatever is on screen rather than clearing it.
      } finally {
        if (active && showSpinner) setLoading(false);
      }
    }

    load();

    const sessionSub = subscribeToSupportSessions((session) => {
      // A case number or handler change on the user's own session: refetch so
      // the header shows the fresh number and the handler's name. A purged
      // session (the case was ended) arrives with payload.new null.
      setSessionActive(session?.status === "active");
      load(false);
    });

    return () => {
      active = false;
      unsubscribe(sessionSub);
    };
  }, [isOpen, apiUrl, currentUserId]);

  useRealtimeMessages<ChatMessageWithUser>({
    channelName: "support-panel-general",
    filter: "support_type=eq.general",
    enabled: isOpen,
    onInsert: (msg) =>
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      }),
  });

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  function formatTime(sentAt: string) {
    return new Date(sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  async function handleSend() {
    if (!newMessage.trim() || sending || currentUserId == null) return;

    const text = newMessage.trim();
    setSending(true);
    setError(null);

    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        support_type: "general",
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

  const chatEnded = !sessionActive && messages.length > 0;

  function loadingIndicator(text: string) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="flex items-center gap-2">
          <div className="size-3 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <p className="text-sm text-muted-fg">{text}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        "fixed bottom-24 right-8 z-50 flex w-[350px] flex-col rounded-xl border border-border bg-surface shadow-[0_8px_30px_rgb(0,0,0,0.12)] " +
        (!isOpen ? "hidden" : "")
      }
      style={{ height: "500px" }}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="material-symbols-rounded text-lg text-brand">support_agent</span>
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-fg">Support</span>
              {sessionInfo.case_number != null && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-fg">
                  CASE-{sessionInfo.case_number}
                </span>
              )}
              {!sessionActive && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-fg">Ended</span>
              )}
            </div>
            {sessionActive && sessionInfo.assigned_to != null && (
              <span className="truncate text-[10px] text-muted-fg">
                with {sessionInfo.assigned_staff_name ?? "a staff member"}
              </span>
            )}
          </div>
        </div>
        <button onClick={onClose} className="text-muted-fg transition-colors hover:text-fg">
          <span className="material-symbols-rounded text-lg">close</span>
        </button>
      </div>

      {!isLoaded ? (
        loadingIndicator("Loading...")
      ) : !user ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="material-symbols-rounded text-3xl text-muted-fg">support_agent</span>
          <SignInPrompt />
        </div>
      ) : loading ? (
        loadingIndicator("Loading messages...")
      ) : (
        <>
          <div ref={bottomRef} className="flex-1 overflow-y-auto p-4 min-h-0">
            <div className="space-y-3">
              {messages.length === 0 && (
                <p className="py-12 text-center text-sm text-muted-fg">No messages yet. How can we help?</p>
              )}

              {messages.map((msg) => {
                const isChatEnded = msg.message.startsWith("[Chat ended");
                const isOwn = msg.user_id === currentUserId;
                const isStaff = isChatStaff(msg.USER?.role);
                if (isChatEnded) {
                  return (
                    <div key={msg.id} className="flex items-center justify-center gap-1.5 py-3">
                      <span className="material-symbols-rounded text-sm text-muted-fg">call_end</span>
                      <span className="text-[11px] text-muted-fg">This conversation has ended.</span>
                    </div>
                  );
                }
                return (
                  <div key={msg.id} className={"flex flex-col " + (isOwn ? "items-end" : "items-start")}>
                    <div className="flex items-center gap-1.5 mb-1">
                      {isStaff && (
                        <span className="inline-flex items-center gap-1 rounded bg-info/10 px-1.5 py-0.5 text-[9px] font-bold text-brand">
                          <span className="material-symbols-rounded text-[10px]">support_agent</span>
                          Staff
                        </span>
                      )}
                      <span className="text-[10px] text-muted-fg">{formatTime(msg.sent_at)}</span>
                    </div>
                    <div
                      className={
                        "max-w-[80%] rounded-xl px-3 py-2 text-sm " +
                        (isOwn ? "bg-brand text-white" : isStaff ? "bg-info/10 text-fg" : "bg-muted text-fg")
                      }
                    >
                      {msg.message}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {chatEnded && (
            <div className="shrink-0 border-t border-border px-4 py-3">
              <p className="text-center text-[11px] text-muted-fg">
                This conversation has ended. Send a message to start a new one.
              </p>
            </div>
          )}

          <MessageComposer value={newMessage} onChange={setNewMessage} onSend={handleSend} sending={sending} error={error} />
        </>
      )}
    </div>
  );
}
