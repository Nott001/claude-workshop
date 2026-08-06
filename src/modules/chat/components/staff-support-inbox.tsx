"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getBrowserClient } from "@/shared/db/browser-client";
import * as chatDao from "@/shared/db/dao/chat.dao";
import { subscribeToSupportSessions, subscribeToSupportMessages, unsubscribe } from "@/shared/integrations/realtime";
import { useSession } from "@/modules/auth/components/session-context";
import { Button } from "@/shared/components/button";
import { Badge } from "@/shared/components/badge";
import type { ChatMessage } from "@/shared/types";

interface CaseSummary {
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

interface ChatMessageWithUser extends ChatMessage {
  USER: { full_name: string; role: string };
}

export default function StaffSupportInbox() {
  const supabase = useMemo(() => getBrowserClient(), []);
  const { user: currentUser } = useSession();
  const currentUserId = currentUser?.id ?? null;

  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [selected, setSelected] = useState<CaseSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessageWithUser[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<CaseSummary | null>(null);

  const loadCases = useCallback(async () => {
    try {
      const res = await fetch("/api/support/cases");
      if (!res.ok) return;
      const data = await res.json();
      setCases(data.cases ?? []);
      // Keep the open case in sync with the queue, closing it when it ends.
      setSelected((prev) => {
        if (!prev) return prev;
        const fresh = (data.cases ?? []).find((c: CaseSummary) => c.id === prev.id);
        return fresh ?? null;
      });
    } catch {
      // A failed refresh keeps the queue already on screen.
    } finally {
      setLoadingCases(false);
    }
  }, []);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    async function load() {
      await loadCases();
    }
    void load();

    const sessionSub = subscribeToSupportSessions(() => loadCases());
    const messageSub = subscribeToSupportMessages("general", undefined, async (msg) => {
      loadCases();
      const sel = selectedRef.current;
      if (sel && msg.session_id === sel.id) {
        const full = await chatDao.findMessageWithUser(supabase, msg.id);
        if (full) {
          setMessages((prev) =>
            prev.some((m) => m.id === full.id) ? prev : [...prev, full as unknown as ChatMessageWithUser],
          );
        }
      }
    });

    return () => {
      unsubscribe(sessionSub);
      unsubscribe(messageSub);
    };
  }, [loadCases, supabase]);

  useEffect(() => {
    if (selected) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, selected]);

  async function openCase(c: CaseSummary) {
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
  }

  async function runAction(c: CaseSummary, action: "claim" | "relinquish") {
    setActing(true);
    setActionError(null);
    try {
      const res = await fetch("/api/support/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, user_id: c.user_id, support_type: "general" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setActionError(data?.error ?? "The action could not be completed.");
        return;
      }
      await loadCases();
    } finally {
      setActing(false);
    }
  }

  async function endCase(c: CaseSummary) {
    if (!confirm(`End case CASE-${c.case_number}? ${c.full_name} can start a new one later.`)) return;
    setActing(true);
    setActionError(null);
    try {
      const res = await fetch("/api/support/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end", user_id: c.user_id, support_type: "general" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setActionError(data?.error ?? "The case could not be ended.");
        return;
      }
      await loadCases();
      setSelected(null);
      setMessages([]);
    } finally {
      setActing(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
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
  }

  function formatTime(sentAt: string) {
    return new Date(sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const isOwner = selected !== null && selected.assigned_to === currentUserId;
  const isUnclaimed = selected !== null && selected.assigned_to === null;

  return (
    <div className="flex overflow-hidden rounded-xl border border-border" style={{ height: "600px" }}>
      <aside className="w-72 shrink-0 overflow-y-auto border-r border-border">
        {loadingCases ? (
          <p className="p-4 text-sm text-muted-fg">Loading cases...</p>
        ) : cases.length === 0 ? (
          <p className="p-4 text-sm text-muted-fg">No open cases right now.</p>
        ) : (
          <ul>
            {cases.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => openCase(c)}
                  className={
                    "block w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/50 " +
                    (selected?.id === c.id ? "bg-muted" : "")
                  }
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-fg">CASE-{c.case_number}</span>
                    {c.assigned_to === null ? (
                      <Badge variant="warning">Unclaimed</Badge>
                    ) : c.assigned_to === currentUserId ? (
                      <Badge variant="success">You</Badge>
                    ) : (
                      <Badge>{c.assigned_name}</Badge>
                    )}
                  </div>
                  <div className="truncate text-sm font-medium text-fg">{c.full_name}</div>
                  <div className="truncate text-xs text-muted-fg">{c.last_message ?? "No messages yet"}</div>
                  {c.last_message_at && (
                    <div className="mt-0.5 text-[10px] text-muted-fg">{new Date(c.last_message_at).toLocaleString()}</div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        {!selected ? (
          <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-fg">
            Select a case on the left to open it.
          </div>
        ) : (
          <>
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-fg">CASE-{selected.case_number}</span>
                  <Badge variant={isUnclaimed ? "warning" : isOwner ? "success" : "default"}>
                    {isUnclaimed ? "Unclaimed" : isOwner ? "Handling" : selected.assigned_name}
                  </Badge>
                </div>
                <div className="truncate text-sm text-muted-fg">{selected.full_name}</div>
              </div>
              <div className="flex shrink-0 gap-2">
                {isUnclaimed && currentUserId != null && (
                  <Button size="sm" onClick={() => runAction(selected, "claim")} disabled={acting}>
                    {acting ? "Claiming..." : "Claim case"}
                  </Button>
                )}
                {isOwner && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => runAction(selected, "relinquish")} disabled={acting}>
                      Relinquish
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => endCase(selected)} disabled={acting}>
                      End case
                    </Button>
                  </>
                )}
              </div>
            </div>

            {actionError && <p className="shrink-0 border-b border-border px-4 py-2 text-xs text-error">{actionError}</p>}

            {selected.assigned_to !== null && selected.assigned_to !== currentUserId && (
              <p className="shrink-0 border-b border-border bg-muted/50 px-4 py-2 text-xs text-muted-fg">
                This case is being handled by {selected.assigned_name ?? "another staff member"}.
              </p>
            )}

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {loadingMessages ? (
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
                        className={
                          "max-w-[80%] rounded-xl px-3 py-2 text-sm " + (isOwn ? "bg-brand text-white" : "bg-muted text-fg")
                        }
                      >
                        {msg.message}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {isOwner ? (
              <form onSubmit={handleSend} className="shrink-0 border-t border-border px-4 py-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    maxLength={1000}
                    className="min-w-0 flex-1 rounded-lg border border-border px-3 py-2 text-sm text-fg outline-none placeholder:text-muted-fg focus:border-brand focus:ring-2 focus:ring-ring/20"
                  />
                  <Button type="submit" size="sm" disabled={sending || !newMessage.trim()}>
                    {sending ? "Sending..." : "Send"}
                  </Button>
                </div>
                {error && <p className="mt-1.5 text-xs text-error">{error}</p>}
              </form>
            ) : isUnclaimed ? (
              <p className="shrink-0 border-t border-border px-4 py-3 text-center text-xs text-muted-fg">
                Claim this case to start replying.
              </p>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
