"use client";

import { useEffect, useRef, useState } from "react";
import { useDebouncedValue } from "@/shared/lib/use-debounced-value";
// The route serves auditDao.list's rows verbatim. The hand-written copy that
// used to live here called the key `log_id`; AUDIT_LOG's primary key is `id`,
// so every row's key was undefined.
import type { AuditLogWithActor } from "@/modules/audit/db/audit.dao";

export function useAuditLogs() {
  const [logs, setLogs] = useState<AuditLogWithActor[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim());
  const appliedSearchRef = useRef(debouncedSearch);

  useEffect(() => {
    let cancelled = false;

    async function fetchLogs() {
      setLoading(true);
      // A new search means a fresh result set, so pagination starts back at
      // page 1. Reset here and hand the fetch back to the re-render's own
      // effect run, which carries page 1 — fetching immediately would double
      // the request. The reset is state set inside the async function, never
      // synchronously in the effect body.
      if (debouncedSearch !== appliedSearchRef.current && page !== 1) {
        appliedSearchRef.current = debouncedSearch;
        setPage(1);
        return;
      }
      appliedSearchRef.current = debouncedSearch;

      try {
        const params = new URLSearchParams({ page: String(page) });
        if (debouncedSearch) params.set("search", debouncedSearch);
        const res = await fetch(`/api/audit-logs?${params}`);
        const data = res.ok ? await res.json() : { logs: [], total: 0 };
        if (!cancelled) {
          setLogs(Array.isArray(data.logs) ? data.logs : []);
          setTotal(data.total ?? 0);
          setTotalPages(Math.max(1, Math.ceil((data.total ?? 0) / 20)));
        }
      } catch {
        if (!cancelled) {
          setLogs([]);
          setTotal(0);
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
  }, [page, debouncedSearch]);

  return { logs, total, loading, page, setPage, totalPages, search, setSearch };
}
