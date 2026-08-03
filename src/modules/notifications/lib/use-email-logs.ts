"use client";

import { useEffect, useState } from "react";
// Same story as the audit logs: EMAIL_LOG's primary key is `id`, not `log_id`.
import type { EmailLogWithUser } from "@/shared/db/dao/email.dao";

export function useEmailLogs() {
  const [logs, setLogs] = useState<EmailLogWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailTypeFilter, setEmailTypeFilter] = useState<"" | "ticket_issued" | "check_in_confirmed">("");
  const [statusFilter, setStatusFilter] = useState<"" | "sent" | "failed">("");

  useEffect(() => {
    let cancelled = false;

    async function fetchLogs() {
      setLoading(true);
      const params = new URLSearchParams();
      if (emailTypeFilter) params.set("email_type", emailTypeFilter);
      if (statusFilter) params.set("status", statusFilter);

      try {
        const res = await fetch(`/api/logs?${params}`);
        const data = res.ok ? await res.json() : [];
        if (!cancelled) setLogs(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setLogs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchLogs();
    return () => {
      cancelled = true;
    };
  }, [emailTypeFilter, statusFilter]);

  return {
    logs,
    loading,
    emailTypeFilter,
    statusFilter,
    setEmailTypeFilter,
    setStatusFilter,
  };
}
