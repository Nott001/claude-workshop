"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { subscribeToChatMessages } from "@/lib/realtime";
import type { ChatMessage, UserRole } from "@/types";

const POLL_INTERVAL = 3000;

interface ChatMessageWithUser extends ChatMessage {
  USER: { full_name: string; role: UserRole };
}

interface SupportUser {
  user_id: number;
  full_name: string;
  last_message: string;
  last_sent_at: string;
  unread: boolean;
  session_active: boolean;
}

export default function SupportPage() {
  const [users, setUsers] = useState<SupportUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessageWithUser[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [usersVersion, setUsersVersion] = useState(0);
  const [messagesVersion, setMessagesVersion] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [endingChat, setEndingChat] = useState(false);
  const [deletingChat, setDeletingChat] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const lastSentAtRef = useRef<string | null>(null);
  const usersFetchId = useRef(0);
  const messagesFetchId = useRef(0);

  useEffect(() => {
    let ignore = false;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!ignore && data) {
          setCurrentUserId(data.user_id);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/support/users");
    if (!res.ok) return;
    const data = await res.json();
    return data.users as SupportUser[];
  }, []);

  const fetchMessages = useCallback(async (userId: number, before?: string) => {
    const params = new URLSearchParams({ limit: "50", user_id: String(userId) });
    if (before) params.set("before", before);
    const res = await fetch(`/api/support?${params}`);
    if (!res.ok) return;
    const data = await res.json();
    return data as { messages: ChatMessageWithUser[]; nextCursor: string | null };
  }, []);

  useEffect(() => {
    const id = ++usersFetchId.current;
    fetchUsers().then((data) => {
      if (id === usersFetchId.current && data) {
        setUsers(data);
        setUsersVersion((v) => v + 1);
      }
    }).catch(() => {});
  }, [fetchUsers]);

  useEffect(() => {
    if (!usersVersion) return;
    let cancelled = false;
    const id = setInterval(async () => {
      let data;
      try {
        data = await fetchUsers();
      } catch {
        return;
      }
      if (cancelled || !data) return;
      setUsers((prev) => {
        const merged = [...data];
        for (const existing of prev) {
          if (!merged.some((u) => u.user_id === existing.user_id)) {
            merged.push(existing);
          }
        }
        merged.sort((a, b) => new Date(b.last_sent_at).getTime() - new Date(a.last_sent_at).getTime());
        for (const m of merged) {
          const existing = prev.find((u) => u.user_id === m.user_id);
          if (existing) {
            m.unread = existing.unread;
          }
        }
        return merged;
      });
    }, POLL_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [fetchUsers, usersVersion]);

  useEffect(() => {
    if (selectedUserId == null) return;
    const id = ++messagesFetchId.current;
    lastSentAtRef.current = null;

    fetchMessages(selectedUserId).then((data) => {
      if (id === messagesFetchId.current && data) {
        setMessages(data.messages ?? []);
        setMessagesVersion((v) => v + 1);
        if (data.messages?.length > 0) {
          lastSentAtRef.current = data.messages[data.messages.length - 1].sent_at;
        }
      }
    });
  }, [selectedUserId, fetchMessages]);

  useEffect(() => {
    if (selectedUserId == null) return;
    const sub = subscribeToChatMessages(null, "global_support", (msg) => {
      if (msg.user_id !== selectedUserId && msg.user_id !== currentUserId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.message_id === msg.message_id)) return prev;
        const next = [...prev, msg as ChatMessageWithUser];
        lastSentAtRef.current = next[next.length - 1].sent_at;
        return next;
      });
    });
    return () => sub.unsubscribe();
  }, [selectedUserId, currentUserId]);

  useEffect(() => {
    if (selectedUserId == null) return;
    let cancelled = false;
    const id = setInterval(async () => {
      const after = lastSentAtRef.current;
      const params = new URLSearchParams({ limit: "10", user_id: String(selectedUserId) });
      if (after) params.set("after", after);
      try {
        const res = await fetch(`/api/support?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data.messages?.length) return;
        setMessages((prev) => {
          const merged = [...prev];
          let changed = false;
          for (const m of data.messages as ChatMessageWithUser[]) {
            if (!merged.some((x) => x.message_id === m.message_id)) {
              merged.push(m);
              changed = true;
            }
          }
          if (changed && merged.length > 0) {
            lastSentAtRef.current = merged[merged.length - 1].sent_at;
          }
          return changed ? merged : prev;
        });
      } catch {}
    }, POLL_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [selectedUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || sending || selectedUserId == null) return;

    setSending(true);
    setError(null);
    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: newMessage.trim(), recipient_user_id: selectedUserId }),
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

    const sent = await res.json();
    setMessages((prev) => {
      if (prev.some((m) => m.message_id === sent.message_id)) return prev;
      const next = [...prev, sent as ChatMessageWithUser];
      lastSentAtRef.current = next[next.length - 1].sent_at;
      return next;
    });

    setNewMessage("");
    setSending(false);

    try {
      const updatedUsers = await fetchUsers();
      if (updatedUsers) {
        setUsers(updatedUsers);
        setUsersVersion((v) => v + 1);
      }
    } catch {}
  }

  async function handleEndChat(userId: number) {
    setEndingChat(true);
    try {
      const msgRes = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "[Chat ended by facilitator]", recipient_user_id: userId }),
      });
      if (msgRes.ok) {
        const msg = await msgRes.json();
        setMessages((prev) => {
          if (prev.some((m) => m.message_id === msg.message_id)) return prev;
          return [...prev, msg as ChatMessageWithUser];
        });
      }
      await fetch("/api/support/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, action: "end" }),
      });
      try {
        const updatedUsers = await fetchUsers();
        if (updatedUsers) {
          setUsers(updatedUsers);
          setUsersVersion((v) => v + 1);
        }
      } catch {}
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
      setUsers((prev) => prev.filter((u) => u.user_id !== userId));
      setUsersVersion((v) => v + 1);
      if (selectedUserId === userId) {
        setSelectedUserId(null);
        setMessages([]);
        setMessagesVersion(0);
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

  const selectedUser = users.find((u) => u.user_id === selectedUserId);
  const sessionActive = selectedUser?.session_active ?? false;
  const usersLoaded = usersVersion > 0;
  const messagesLoaded = messagesVersion > 0 && selectedUserId != null;

  return (
    <div className="flex h-full">
      <div className="flex w-[280px] flex-col border-r border-[#E8ECEF] bg-white">
        <div className="flex shrink-0 items-center border-b border-[#E8ECEF] px-4 py-3">
          <span className="text-sm font-semibold text-[#1b1c1c]">Support Inbox</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!usersLoaded ? (
            <div className="flex items-center justify-center p-4">
              <div className="size-3 animate-spin rounded-full border-2 border-[#3db9ee] border-t-transparent" />
            </div>
          ) : users.length === 0 ? (
            <p className="p-4 text-center text-xs text-[#8B989E]">No support requests yet.</p>
          ) : (
            users.map((user) => (
              <button
                key={user.user_id}
                onClick={() => setSelectedUserId(user.user_id)}
                className={
                  "flex w-full flex-col gap-1 border-b border-[#F0F2F4] px-4 py-3 text-left transition-colors hover:bg-[#F8FAFB] " +
                  (selectedUserId === user.user_id ? "bg-[#e8f8fe]" : "")
                }
              >
                  <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-semibold text-[#1b1c1c]">{user.full_name}</span>
                    {user.session_active ? (
                      <span className="size-1.5 shrink-0 rounded-full bg-[#3db9ee]" title="Active" />
                    ) : (
                      <span className="size-1.5 shrink-0 rounded-full bg-[#8B989E]" title="Ended" />
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] text-[#8B989E]">{formatUserTime(user.last_sent_at)}</span>
                </div>
                <span className="truncate text-[11px] text-[#6E7980]">{user.last_message}</span>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col bg-[#F8FAFB]">
        {selectedUserId == null ? (
          <div className="flex flex-1 items-center justify-center p-4">
            <p className="text-sm text-[#8B989E]">Select a conversation to view messages.</p>
          </div>
        ) : (
          <>
            <div className="flex shrink-0 items-center justify-between border-b border-[#E8ECEF] bg-white px-6 py-3">
              <div className="flex items-center gap-2">
                <div className="grid size-8 place-items-center rounded-full bg-[#3db9ee] text-xs font-bold text-white">
                  {selectedUser?.full_name?.charAt(0)?.toUpperCase() ?? "?"}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#1b1c1c]">{selectedUser?.full_name ?? "Unknown"}</span>
                  {sessionActive ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(0,150,199,0.1)] px-2 py-0.5 text-[10px] font-semibold text-[#00658d]">
                      <span className="size-1.5 rounded-full bg-[#3db9ee]" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(139,152,158,0.1)] px-2 py-0.5 text-[10px] font-semibold text-[#6E7980]">
                      Ended
                    </span>
                  )}
                </div>
              </div>
              {sessionActive && (
                <button
                  onClick={() => handleEndChat(selectedUserId)}
                  disabled={endingChat}
                  className="flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-[10px] font-bold text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50"
                >
                  <span className="material-symbols-rounded text-xs">call_end</span>
                  End Chat
                </button>
              )}
              {!sessionActive && selectedUserId != null && (
                <button
                  onClick={() => handleDeleteChat(selectedUserId)}
                  disabled={deletingChat}
                  className="flex items-center gap-1 rounded-lg border border-[#E8ECEF] px-2.5 py-1.5 text-[10px] font-bold text-[#6E7980] transition-colors hover:border-red-200 hover:text-red-500 disabled:opacity-50"
                >
                  <span className="material-symbols-rounded text-xs">delete</span>
                  Delete
                </button>
              )}
            </div>

            {!messagesLoaded ? (
              <div className="flex flex-1 items-center justify-center p-4">
                <div className="flex items-center gap-2">
                  <div className="size-3 animate-spin rounded-full border-2 border-[#3db9ee] border-t-transparent" />
                  <p className="text-sm text-[#6E7980]">Loading messages...</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 min-h-0">
                <div className="mx-auto max-w-2xl space-y-3">
                  {messages.length === 0 && <p className="py-12 text-center text-sm text-[#8B989E]">No messages yet.</p>}

                  {messages.map((msg) => {
                    const isChatEnded = msg.message.startsWith("[Chat ended");
                    if (isChatEnded) {
                      return (
                        <div key={msg.message_id} className="flex items-center justify-center gap-1.5 py-3">
                          <span className="material-symbols-rounded text-sm text-[#8B989E]">call_end</span>
                          <span className="text-[11px] text-[#8B989E]">This conversation has ended.</span>
                        </div>
                      );
                    }
                    const isOwn = msg.user_id === currentUserId;
                    const isStaff = msg.USER?.role === "facilitator";
                    return (
                      <div key={msg.message_id} className={"flex flex-col " + (isOwn ? "items-end" : "items-start")}>
                        <div className="flex items-center gap-1.5 mb-1">
                          {!isOwn && (
                            <span className="text-[10px] font-semibold text-[#1b1c1c]">{msg.USER?.full_name ?? "Unknown"}</span>
                          )}
                          {isStaff && (
                            <span className="inline-flex items-center gap-1 rounded bg-[#e3f2fd] px-1.5 py-0.5 text-[9px] font-bold text-[#00658d]">
                              Staff
                            </span>
                          )}
                          <span className="text-[10px] text-[#8B989E]">{formatTime(msg.sent_at)}</span>
                        </div>
                        <div
                          className={
                            "max-w-[80%] rounded-xl px-3 py-2 text-sm " +
                            (isOwn
                              ? "bg-[#3db9ee] text-white"
                              : isStaff
                                ? "bg-[#e3f2fd] text-[#1b1c1c]"
                                : "bg-white text-[#1b1c1c] shadow-sm")
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

            <form onSubmit={handleSend} className="shrink-0 border-t border-[#E8ECEF] bg-white px-6 py-4">
              <div className="mx-auto flex max-w-2xl gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={sessionActive ? "Type a reply..." : "This conversation has ended."}
                  maxLength={1000}
                  disabled={!sessionActive}
                  className="min-w-0 flex-1 rounded-lg border border-[#DDE3E7] px-3 py-2 text-sm text-[#1b1c1c] outline-none placeholder:text-[#8B989E] focus:border-[#3db9ee] focus:ring-2 focus:ring-[#3db9ee]/20 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim() || !sessionActive}
                  className="flex items-center gap-1 rounded-lg bg-[#3db9ee] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#039be5] disabled:cursor-not-allowed disabled:opacity-50"
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
              {error && <p className="mx-auto mt-1.5 max-w-2xl text-xs text-red-500">{error}</p>}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
