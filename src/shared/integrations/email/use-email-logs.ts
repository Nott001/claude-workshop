"use client";

import { useCallback, useEffect, useRef, useState } from "react";
// Same story as the audit logs: EMAIL_LOG's primary key is `id`, not `log_id`.
import type { EmailLogWithUser } from "@/shared/db/dao/email.dao";
import type { EmailType, EmailStatus } from "@/shared/types";

const PAGE_SIZE = 50;

export function useEmailLogs() {
  const [logs, setLogs] = useState<EmailLogWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [emailTypeFilter, setEmailTypeFilter] = useState<"" | EmailType>("");
  const [statusFilter, setStatusFilter] = useState<"" | EmailStatus>("");
  const pageRef = useRef(1);

  const load = useCallback(
    async (page: number, append: boolean) => {
      try {
        const params = new URLSearchParams();
        if (emailTypeFilter) params.set("email_type", emailTypeFilter);
        if (statusFilter) params.set("status", statusFilter);
        params.set("page", String(page));
        params.set("limit", String(PAGE_SIZE));

        const res = await fetch(`/api/logs?${params}`);
        if (!res.ok) {
          return false;
        }
        const data = await res.json();
        const rows = (Array.isArray(data.data) ? data.data : []) as EmailLogWithUser[];
        setLogs((prev) => (append ? [...prev, ...rows] : rows));
        setHasMore((data.total ?? 0) > page * PAGE_SIZE);
        return true;
      } catch {
        return false;
      }
    },
    [emailTypeFilter, statusFilter],
  );

  useEffect(() => {
    let cancelled = false;
    pageRef.current = 1;

    async function loadFirstPage() {
      setLoading(true);
      try {
        await load(1, false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadFirstPage();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    const next = pageRef.current + 1;
    pageRef.current = next;
    await load(next, true);
    setLoadingMore(false);
  }, [load, loadingMore]);

  return {
    logs,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    emailTypeFilter,
    statusFilter,
    setEmailTypeFilter,
    setStatusFilter,
  };
}
