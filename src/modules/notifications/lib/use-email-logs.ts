"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/modules/auth";

type EmailType = "ticket_issued" | "check_in_confirmed";
type EmailStatus = "sent" | "failed";

interface EmailLog {
  log_id: number;
  user_id: number;
  email_type: EmailType;
  status: EmailStatus;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  USER: { full_name: string; email: string } | null;
}

export function useEmailLogs() {
  const router = useRouter();
  const { loading: isLoaded, isSignedIn, user } = useSession();
  const userRole = user?.role ?? null;
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailTypeFilter, setEmailTypeFilter] = useState<EmailType | "">("");
  const [statusFilter, setStatusFilter] = useState<EmailStatus | "">("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || userRole !== "facilitator") {
      router.push("/");
    }
  }, [isLoaded, isSignedIn, userRole, router]);

  useEffect(() => {
    if (userRole !== "facilitator") return;
    let ignore = false;

    async function load() {
      setLoading(true);
      const params = new URLSearchParams();
      if (emailTypeFilter) params.set("email_type", emailTypeFilter);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/logs?${params}`);
      if (res.ok && !ignore) {
        const data = await res.json();
        setLogs(data);
      }
      setLoading(false);
    }

    load();
    return () => {
      ignore = true;
    };
  }, [userRole, emailTypeFilter, statusFilter]);

  return { logs, loading, emailTypeFilter, statusFilter, setEmailTypeFilter, setStatusFilter, userRole, isLoaded };
}
