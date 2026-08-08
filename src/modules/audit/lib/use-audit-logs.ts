"use client";

import { useEffect, useState } from "react";
// The route serves auditDao.list's rows verbatim. The hand-written copy that
// used to live here called the key `log_id`; AUDIT_LOG's primary key is `id`,
// so every row's key was undefined.
import type { AuditLogWithActor } from "@/modules/audit/db/audit.dao";

export function useAuditLogs() {
  const [logs, setLogs] = useState<AuditLogWithActor[]>([]);
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
