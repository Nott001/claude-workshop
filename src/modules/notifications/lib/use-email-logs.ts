"use client";

import { useEffect, useState } from "react";

interface EmailLogEntry {
  log_id: number;
  email_type: "ticket_issued" | "check_in_confirmed";
  status: "sent" | "failed";
  sent_at: string | null;
  USER: { full_name: string; email: string } | null;
}

export function useEmailLogs() {
  const [logs, setLogs] = useState<EmailLogEntry[]>([]);
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
