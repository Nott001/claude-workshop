"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { useSession } from "@/modules/auth";
import { subscribeToSupportSessions } from "@/lib/realtime";
import type { ChatMessage, UserRole } from "@/types";
import { SupportUserList } from "@/modules/support/ui/support-user-list";
import { SupportChatHeader } from "@/modules/support/ui/support-chat-header";
import { SupportMessageList } from "@/modules/support/ui/support-message-list";
import { SupportMessageInput } from "@/modules/support/ui/support-message-input";

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
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [endingChat, setEndingChat] = useState(false);
  const [deletingChat, setDeletingChat] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<ChatMessageWithUser[]>([]);

  const { user: currentUser } = useSession();
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

  async function handleSend(text: string) {
    if (selectedUserId == null || currentUserId == null) return;

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

    await res.json();
    setPendingMessages((prev) => prev.filter((m) => m.id !== optimisticId));
    setSending(false);
    mutateUsers();
    setActive();
  }

  async function handleEndChat() {
    if (selectedUserId == null) return;
    setEndingChat(true);
    try {
      await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "[Chat ended by facilitator]", recipient_user_id: selectedUserId }),
      });
      await fetch("/api/support/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: selectedUserId, action: "end" }),
      });
      mutateUsers();
    } finally {
      setEndingChat(false);
    }
  }

  async function handleDeleteChat() {
    if (selectedUserId == null) return;
    setDeletingChat(true);
    try {
      const res = await fetch(`/api/support/sessions/${selectedUserId}`, {
        method: "DELETE",
      });
      if (!res.ok) return;
      mutateUsers();
      setSelectedUserId(null);
    } finally {
      setDeletingChat(false);
    }
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
        <SupportUserList
          users={users}
          selectedUserId={selectedUserId}
          loading={!usersLoaded}
          onSelectUser={setSelectedUserId}
        />
      </div>

      <div className="flex flex-1 flex-col bg-muted">
        {selectedUserId == null ? (
          <div className="flex flex-1 items-center justify-center p-4">
            <p className="text-sm text-muted-fg">Select a conversation to view messages.</p>
          </div>
        ) : (
          <>
            <SupportChatHeader
              user={selectedUser}
              sessionActive={sessionActive}
              endingChat={endingChat}
              deletingChat={deletingChat}
              onEndChat={handleEndChat}
              onDeleteChat={handleDeleteChat}
            />
            <SupportMessageList messages={allMessages} currentUserId={currentUserId} loading={messagesLoading} />
            <SupportMessageInput sessionActive={sessionActive} sending={sending} error={error} onSend={handleSend} />
          </>
        )}
      </div>
    </div>
  );
}
