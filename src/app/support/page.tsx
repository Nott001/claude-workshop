"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { useCurrentUser } from "@/hooks/use-current-user";
import { subscribeToSupportSessions } from "@/lib/realtime";
import type { ChatMessage, UserRole } from "@/types";

interface ChatMessageWithUser extends ChatMessage {
  USER: { full_name: string; role: UserRole };
}

interface SupportUser {
  id: number;
  full_name: string;
  last_message: string;
  last_sent_at: string;
  unread: boolean;
  session_active: boolean;
}

interface SupportData {
  messages: ChatMessageWithUser[];
  session_active: boolean;
}

export default function SupportPage() {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [endingChat, setEndingChat] = useState(false);
  const [deletingChat, setDeletingChat] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<ChatMessageWithUser[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);

  const { user: currentUser } = useCurrentUser();
  const currentUserId = currentUser?.id ?? null;

  const {
    data: usersData,
    isLoading: usersLoading,
    mutate: mutateUsers,
  } = useSWR<{ users: SupportUser[] }>("/api/support/users", fetcher, {
    refreshInterval: 10000,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
  const users = usersData?.users ?? [];

  const messagesKey = selectedUserId != null ? `/api/support?user_id=${selectedUserId}` : null;
  const pollIntervalRef = useRef(5000);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const prevLastMsgRef = useRef(0);

  function setActive() {
    pollIntervalRef.current = 2000;
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      pollIntervalRef.current = 5000;
    }, 30000);
  }

  const { data: messagesData, isLoading: messagesLoading } = useSWR<SupportData>(messagesKey, fetcher, {
    refreshInterval: () => pollIntervalRef.current,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    keepPreviousData: true,
  });

  const serverMessages = messagesData?.messages ?? [];

  useEffect(() => {
    if (messagesData?.messages?.length) {
      const last = messagesData.messages[messagesData.messages.length - 1];
      if (last.id !== prevLastMsgRef.current) {
        prevLastMsgRef.current = last.id;
        setActive();
      }
    }
  }, [messagesData]);

  const allMessages = useMemo(() => {
    const merged = [...serverMessages];
    for (const p of pendingMessages) {
      if (!merged.some((m) => m.id === p.id)) {
        merged.push(p);
      }
    }
    return merged.sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());
  }, [serverMessages, pendingMessages]);

  useEffect(() => {
    const sub = subscribeToSupportSessions(() => {
      mutateUsers();
    });
    return () => sub.unsubscribe();
  }, [mutateUsers]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || sending || selectedUserId == null || currentUserId == null) return;

    const text = newMessage.trim();
    const optimisticId = -Date.now();
    const optimistic: ChatMessageWithUser = {
      id: optimisticId,
      channel: "global_support",
      user_id: currentUserId,
      message: text,
      sent_at: new Date().toISOString(),
      session_id: 0,
      recipient_user_id: selectedUserId,
      reply_to: null,
      answered_verbally: false,
      deleted_at: null,
      updated_at: null,
      USER: { full_name: currentUser?.full_name ?? "You", role: (currentUser?.role ?? "attendee") as UserRole },
    };
    setPendingMessages((prev) => [...prev, optimistic]);
    setNewMessage("");
    setSending(true);
    setError(null);

    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, recipient_user_id: selectedUserId }),
    });

    if (res.status === 429) {
      setPendingMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setError("Too many messages. Please wait a moment.");
      setSending(false);
      return;
    }

    if (!res.ok) {
      setPendingMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setError("Failed to send message.");
      setSending(false);
      return;
    }

    const sent = (await res.json()) as ChatMessageWithUser;
    setPendingMessages((prev) => prev.filter((m) => m.id !== optimisticId));
    setSending(false);
    mutateUsers();
    setActive();
  }

  async function handleEndChat(userId: number) {
    setEndingChat(true);
    try {
      await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "[Chat ended by facilitator]", recipient_user_id: userId }),
      });
      await fetch("/api/support/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, action: "end" }),
      });
      mutateUsers();
    } finally {
      setEndingChat(false);
    }
  }

  async function handleDeleteChat(userId: number) {
    setDeletingChat(true);
    try {
      const res = await fetch(`/api/support/sessions/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) return;
      mutateUsers();
      if (selectedUserId === userId) {
        setSelectedUserId(null);
      }
    } finally {
      setDeletingChat(false);
    }
  }

  function formatTime(sentAt: string) {
    const d = new Date(sentAt);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatUserTime(sentAt: string) {
    const d = new Date(sentAt);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  const selectedUser = users.find((u) => u.id === selectedUserId);
  const sessionActive = selectedUser?.session_active ?? false;
  const usersLoaded = !usersLoading;

  return (
    <div className="flex h-full">
      <div className="flex w-[280px] flex-col border-r border-border bg-surface">
        <div className="flex shrink-0 items-center border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-fg">Support Inbox</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!usersLoaded ? (
            <div className="flex items-center justify-center p-4">
              <div className="size-3 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            </div>
          ) : users.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-fg">No support requests yet.</p>
          ) : (
            users.map((user) => (
              <button
                key={user.id}
                onClick={() => setSelectedUserId(user.id)}
                className={
                  "flex w-full flex-col gap-1 border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted " +
                  (selectedUserId === user.id ? "bg-brand/10" : "")
                }
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-semibold text-fg">{user.full_name}</span>
                    {user.session_active ? (
                      <span className="size-1.5 shrink-0 rounded-full bg-brand" title="Active" />
                    ) : (
                      <span className="size-1.5 shrink-0 rounded-full bg-muted-fg" title="Ended" />
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-fg">{formatUserTime(user.last_sent_at)}</span>
                </div>
                <span className="truncate text-[11px] text-muted-fg">{user.last_message}</span>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col bg-muted">
        {selectedUserId == null ? (
          <div className="flex flex-1 items-center justify-center p-4">
            <p className="text-sm text-muted-fg">Select a conversation to view messages.</p>
          </div>
        ) : (
          <>
            <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface px-6 py-3">
              <div className="flex items-center gap-2">
                <div className="grid size-8 place-items-center rounded-full bg-brand text-xs font-bold text-white">
                  {selectedUser?.full_name?.charAt(0)?.toUpperCase() ?? "?"}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-fg">{selectedUser?.full_name ?? "Unknown"}</span>
                  {sessionActive ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(0,150,199,0.1)] px-2 py-0.5 text-[10px] font-semibold text-brand">
                      <span className="size-1.5 rounded-full bg-brand" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(139,152,158,0.1)] px-2 py-0.5 text-[10px] font-semibold text-muted-fg">
                      Ended
                    </span>
                  )}
                </div>
              </div>
              {sessionActive && (
                <button
                  onClick={() => handleEndChat(selectedUserId)}
                  disabled={endingChat}
                  className="flex items-center gap-1 rounded-lg border border-error/30 px-2.5 py-1.5 text-[10px] font-bold text-error transition-colors hover:bg-error/10 disabled:opacity-50"
                >
                  <span className="material-symbols-rounded text-xs">call_end</span>
                  End Chat
                </button>
              )}
              {!sessionActive && selectedUserId != null && (
                <button
                  onClick={() => handleDeleteChat(selectedUserId)}
                  disabled={deletingChat}
                  className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[10px] font-bold text-muted-fg transition-colors hover:border-error/30 hover:text-error disabled:opacity-50"
                >
                  <span className="material-symbols-rounded text-xs">delete</span>
                  Delete
                </button>
              )}
            </div>

            {messagesLoading && serverMessages.length === 0 ? (
              <div className="flex flex-1 items-center justify-center p-4">
                <div className="flex items-center gap-2">
                  <div className="size-3 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                  <p className="text-sm text-muted-fg">Loading messages...</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 min-h-0">
                <div className="mx-auto max-w-2xl space-y-3">
                  {allMessages.length === 0 && <p className="py-12 text-center text-sm text-muted-fg">No messages yet.</p>}

                  {allMessages.map((msg) => {
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
                          {!isOwn && (
                            <span className="text-[10px] font-semibold text-fg">{msg.USER?.full_name ?? "Unknown"}</span>
                          )}
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
            )}

            <form onSubmit={handleSend} className="shrink-0 border-t border-border bg-surface px-6 py-4">
              <div className="mx-auto flex max-w-2xl gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={sessionActive ? "Type a reply..." : "This conversation has ended."}
                  maxLength={1000}
                  disabled={!sessionActive}
                  className="min-w-0 flex-1 rounded-lg border border-border px-3 py-2 text-sm text-fg outline-none placeholder:text-muted-fg focus:border-brand focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim() || !sessionActive}
                  className="flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand/80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? (
                    <div className="size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <span className="material-symbols-rounded text-sm">send</span>
                      Send
                    </>
                  )}
                </button>
              </div>
              {error && <p className="mx-auto mt-1.5 max-w-2xl text-xs text-error">{error}</p>}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
