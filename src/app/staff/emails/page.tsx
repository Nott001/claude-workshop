"use client";

import { ROLES } from "@/shared/lib/roles";
import { useState } from "react";
import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/select";
import { useEmailLogs } from "@/shared/integrations/email/use-email-logs";
import { LoadMoreButton } from "@/shared/components/load-more";
import { Badge } from "@/shared/components/badge";
import { Drawer } from "@/shared/components/drawer";
import { TableToolbar } from "@/shared/components/table-toolbar";
import { StaffPage, StaffPageHeader, StaffPageSkeleton } from "@/shared/components/staff-page";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableBodyState,
  TableHead,
  TableHeadCell,
  TableRow,
} from "@/shared/components/table";
import { EMAIL_TYPES, EMAIL_STATUSES } from "@/shared/types";
import type { EmailLogWithUser } from "@/shared/db/dao/email.dao";
import type { EmailType, EmailStatus } from "@/shared/types";

const EMAIL_TYPE_LABELS: Record<EmailType, string> = {
  ticket_issued: "Ticket Issued",
  check_in_confirmed: "Check-In Confirmed",
  event_survey: "Event Survey",
};

const STATUS_LABELS: Record<EmailStatus, string> = {
  sent: "Sent",
  failed: "Failed",
};

// Derived so a new enum member reaches the dropdown by adding its label alone.
const EMAIL_TYPE_OPTIONS: { value: EmailType | ""; label: string }[] = [
  { value: "", label: "All types" },
  ...EMAIL_TYPES.map((value) => ({ value, label: EMAIL_TYPE_LABELS[value] })),
];

const STATUS_OPTIONS: { value: EmailStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  ...EMAIL_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] })),
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString();
}

export default function StaffEmailsPage() {
  const { allowed, pending } = useRoleGuard(ROLES.ADMIN);
  const {
    logs,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    emailTypeFilter,
    statusFilter,
    setEmailTypeFilter,
    setStatusFilter,
    search,
    setSearch,
  } = useEmailLogs();
  const [selected, setSelected] = useState<EmailLogWithUser | null>(null);

  if (pending) {
    return <StaffPageSkeleton rows={15} />;
  }

  if (!allowed) return null;

  return (
    <>
      <StaffPage>
        <StaffPageHeader title="Email Logs" description="Every message the platform has sent, and whether it arrived." />

        <TableToolbar search={{ value: search, onChange: setSearch, placeholder: "Search recipient name or email..." }}>
          <div className="flex gap-3">
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
        </TableToolbar>

        {error && logs.length > 0 && (
          <p className="mt-2 text-sm text-error">Failed to refresh email logs — showing last loaded results.</p>
        )}

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeadCell>User</TableHeadCell>
                <TableHeadCell className="w-32">Email Type</TableHeadCell>
                <TableHeadCell className="w-24">Status</TableHeadCell>
                <TableHeadCell className="w-44">Sent At</TableHeadCell>
                <TableHeadCell className="w-12" aria-label="Details" />
              </TableRow>
            </TableHead>
            <TableBody busy={loading && logs.length > 0}>
              <TableBodyState
                ready={logs.length > 0}
                loading={loading}
                colSpan={5}
                empty={{
                  icon: "mail",
                  title: "No email logs found",
                  hint: search ? "Try a different search term." : "No emails match the current filters.",
                }}
              >
                {logs.map((log) => (
                  <TableRow
                    key={log.id}
                    onClick={() => setSelected(log)}
                    aria-label={`View ${EMAIL_TYPE_LABELS[log.email_type] ?? log.email_type}`}
                  >
                    <TableCell>
                      <div className="flex min-w-0 flex-col">
                        <span className="font-medium text-fg">{log.USER?.full_name ?? "Unknown"}</span>
                        <span className="truncate text-xs text-muted-fg">{log.USER?.email ?? ""}</span>
                      </div>
                    </TableCell>
                    <TableCell>{EMAIL_TYPE_LABELS[log.email_type] ?? log.email_type}</TableCell>
                    <TableCell>
                      <Badge variant={log.status === "sent" ? "success" : "error"}>
                        {STATUS_LABELS[log.status] ?? log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="truncate text-muted-fg">{formatDate(log.sent_at)}</TableCell>
                    <TableCell className="w-12">
                      <span aria-hidden className="material-symbols-rounded text-base text-muted-fg">
                        chevron_right
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBodyState>
            </TableBody>
          </Table>
        </TableContainer>
        {hasMore && <LoadMoreButton loading={loadingMore} onLoadMore={loadMore} />}
      </StaffPage>

      <Drawer
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected?.USER?.full_name ?? "Unknown"}
        description={selected?.USER?.email}
      >
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-fg">Email Type</span>
              <span className="text-fg">{EMAIL_TYPE_LABELS[selected.email_type] ?? selected.email_type}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-fg">Status</span>
              <Badge variant={selected.status === "sent" ? "success" : "error"}>
                {STATUS_LABELS[selected.status] ?? selected.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-fg">Sent At</span>
              <span className="text-fg">{formatDate(selected.sent_at)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-fg">Created At</span>
              <span className="text-fg">{formatDate(selected.created_at)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-fg">ID</span>
              <span className="text-fg">{selected.id}</span>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}
