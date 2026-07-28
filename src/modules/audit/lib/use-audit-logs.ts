"use client";

import { useEffect, useState } from "react";

interface AuditLogEntry {
  log_id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  ACTOR: { full_name: string; email: string } | null;
}

export function useAuditLogs() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    let cancelled = false;

    async function fetchLogs() {
      setLoading(true);
      try {
        const res = await fetch(`/api/audit-logs?page=${page}`);
        const data = res.ok ? await res.json() : { logs: [], total: 0 };
        if (!cancelled) {
          setLogs(Array.isArray(data.logs) ? data.logs : []);
          setTotalPages(Math.max(1, Math.ceil((data.total ?? 0) / 20)));
        }
      } catch {
        if (!cancelled) {
          setLogs([]);
          setTotalPages(1);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchLogs();
    return () => {
      cancelled = true;
    };
  }, [page]);

  return { logs, loading, page, setPage, totalPages };
}
