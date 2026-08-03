"use client";

import { useSession, useRoleGuard } from "@/modules/auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Footer } from "@/shared/components/footer";
import { useEmailLogs } from "@/modules/notifications/lib/use-email-logs";

type EmailType = "ticket_issued" | "check_in_confirmed";
type EmailStatus = "sent" | "failed";

const EMAIL_TYPE_LABELS: Record<EmailType, string> = {
  ticket_issued: "Ticket Issued",
  check_in_confirmed: "Check-In Confirmed",
};

const EMAIL_TYPE_OPTIONS: { value: EmailType | ""; label: string }[] = [
  { value: "", label: "All types" },
  { value: "ticket_issued", label: "Ticket Issued" },
  { value: "check_in_confirmed", label: "Check-In Confirmed" },
];

const STATUS_OPTIONS: { value: EmailStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString();
}

export default function StaffEmailsPage() {
  const { user } = useSession();
  const { allowed, pending } = useRoleGuard("admin");
  const { logs, loading, emailTypeFilter, statusFilter, setEmailTypeFilter, setStatusFilter } = useEmailLogs();

  if (pending) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!allowed) return null;

  return (
    <>
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-base font-bold text-foreground">Email Logs</span>
        </div>

        <div className="mb-4 flex gap-3">
          <Select value={emailTypeFilter} onValueChange={(v) => setEmailTypeFilter(v as EmailType | "")}>
            <SelectTrigger>
              <SelectValue>{EMAIL_TYPE_OPTIONS.find((o) => o.value === emailTypeFilter)?.label ?? "All types"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {EMAIL_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as EmailStatus | "")}>
            <SelectTrigger>
              <SelectValue>{STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label ?? "All statuses"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="text-sm text-muted-foreground">Loading emails...</div>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="text-sm text-muted-foreground">No email logs found.</div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted text-xs font-semibold uppercase tracking-[0.04em] text-muted-fg">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Email Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Sent At</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted">
                    <td className="px-4 py-3 text-foreground">
                      <div className="font-medium">{log.USER?.full_name ?? "Unknown"}</div>
                      <div className="text-xs text-muted-foreground">{log.USER?.email ?? ""}</div>
                    </td>
                    <td className="px-4 py-3 text-foreground">{EMAIL_TYPE_LABELS[log.email_type] ?? log.email_type}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          log.status === "sent" ? "bg-success/20 text-success" : "bg-error/20 text-red-800"
                        }`}
                      >
                        {log.status === "sent" ? "Sent" : "Failed"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(log.sent_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Footer role={user?.role as "facilitator" | "speaker" | "attendee"} />
    </>
  );
}
