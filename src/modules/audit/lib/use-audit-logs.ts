"use client";

import { useEffect, useState } from "react";

interface AuditLog {
  log_id: number;
  actor_id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  ACTOR: { user_id: number; full_name: string; email: string } | null;
}

export function useAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch(`/api/audit-logs?page=${page}&limit=${limit}`);
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
      setLoading(false);
    }
    load();
  }, [page]);

  const totalPages = Math.ceil(total / limit);

  return { logs, loading, page, setPage, totalPages };
}
