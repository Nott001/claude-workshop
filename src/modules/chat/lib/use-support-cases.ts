"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeToSupportSessions, unsubscribe } from "@/shared/integrations/realtime";
import { useSession } from "@/modules/auth/components/session-context";
import { useRealtimeMessages, CHAT_TABLE } from "@/modules/chat/lib/use-realtime-messages";
import type { ChatMessageWithUser } from "@/modules/chat/lib/types";

export interface CaseSummary {
  id: number;
  case_number: number;
  status: string;
  user_id: number;
  full_name: string;
  assigned_to: number | null;
  assigned_name: string | null;
  last_message: string | null;
  last_message_at: string | null;
}

export function useSupportCases() {
  const { user: currentUser } = useSession();
  const currentUserId = currentUser?.id ?? null;

  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [loadingMoreCases, setLoadingMoreCases] = useState(false);
  const [hasMoreCases, setHasMoreCases] = useState(false);
  const casesPageRef = useRef(1);
  const [selected, setSelected] = useState<CaseSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessageWithUser[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const selectedRef = useRef<CaseSummary | null>(null);

  const loadCases = useCallback(async () => {
    try {
      casesPageRef.current = 1;
      const res = await fetch("/api/support/cases");
      if (!res.ok) return;
      const data = await res.json();
      const rows = (Array.isArray(data.data) ? data.data : []) as CaseSummary[];
      setCases(rows);
      setHasMoreCases((data.total ?? 0) > (data.limit ?? 50));
      // Keep the open case in sync with the queue, closing it when it ends.
      setSelected((prev) => {
        if (!prev) return prev;
        return rows.find((c) => c.id === prev.id) ?? null;
      });
    } catch {
      // A failed refresh keeps the queue already on screen.
    } finally {
      setLoadingCases(false);
    }
  }, []);

  const loadMoreCases = useCallback(async () => {
    if (loadingMoreCases) return;
    setLoadingMoreCases(true);
    const next = casesPageRef.current + 1;
    casesPageRef.current = next;
    try {
      const res = await fetch(`/api/support/cases?page=${next}&limit=50`);
      if (!res.ok) return;
      const data = await res.json();
      const rows = (Array.isArray(data.data) ? data.data : []) as CaseSummary[];
      setCases((prev) => {
        const merged = new Map<number, CaseSummary>();
        for (const c of [...prev, ...rows]) merged.set(c.id, c);
        return [...merged.values()];
      });
      setHasMoreCases((data.total ?? 0) > next * (data.limit ?? 50));
    } catch {
      // A failed page keeps the queue already on screen.
    } finally {
      setLoadingMoreCases(false);
    }
  }, [loadingMoreCases]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    async function load() {
      await loadCases();
    }
    void load();

    const sessionSub = subscribeToSupportSessions(() => loadCases());

    return () => {
      unsubscribe(sessionSub);
    };
  }, [loadCases]);

  useRealtimeMessages<ChatMessageWithUser>({
    channelName: "support-inbox-general",
    table: CHAT_TABLE,
    filter: "support_type=eq.general",
    relevant: (row) => row.session_id === selectedRef.current?.id,
    onInsert: (msg) =>
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      }),
  });

  const openCase = useCallback(async (c: CaseSummary) => {
    setSelected(c);
    setMessages([]);
    setLoadingMessages(true);
    setError(null);
    setActionError(null);
    try {
      const res = await fetch(`/api/support?support_type=general&user_id=${c.user_id}`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      // A failed load keeps the case open with the messages it had.
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const runAction = useCallback(
    async (action: "claim" | "relinquish" | "end") => {
      if (!selected) return;
      if (
        action === "end" &&
        !confirm(
          `End case CASE-${selected.case_number}? This deletes the conversation history; ${selected.full_name} can start a new one later.`,
        )
      ) {
        return;
      }
      setActing(true);
      setActionError(null);
      try {
        const res = await fetch("/api/support/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, user_id: selected.user_id, support_type: "general" }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setActionError(data?.error ?? "The action could not be completed.");
          return;
        }
        await loadCases();
        if (action === "end") {
          setSelected(null);
          setMessages([]);
        }
      } finally {
        setActing(false);
      }
    },
    [loadCases, selected],
  );

  const sendMessage = useCallback(async () => {
    if (!selected || !newMessage.trim() || sending) return;

    const text = newMessage.trim();
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ support_type: "general", message: text, recipient_user_id: selected.user_id }),
      });

      if (res.status === 429) {
        setError("Too many messages. Please wait a moment.");
      } else if (res.status === 409) {
        setError("Claim this case before replying.");
      } else if (res.status === 403) {
        setError("This case is now handled by another staff member.");
      } else if (!res.ok) {
        setError("Failed to send message.");
      }
      setNewMessage("");
    } finally {
      setSending(false);
    }
  }, [newMessage, selected, sending]);

  return {
    cases,
    loadingCases,
    loadingMoreCases,
    hasMoreCases,
    loadMoreCases,
    selected,
    messages,
    loadingMessages,
    newMessage,
    setNewMessage,
    sending,
    acting,
    error,
    actionError,
    currentUserId,
    openCase,
    claimCase: () => runAction("claim"),
    relinquishCase: () => runAction("relinquish"),
    endCase: () => runAction("end"),
    sendMessage,
  };
}
