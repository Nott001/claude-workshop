"use client";

import { useEffect, useState } from "react";
import { Button } from "@/shared/components/button";
import { Drawer } from "@/shared/components/drawer";
import {
  Table,
  TableHead,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell,
  TableEmpty,
  TableContainer,
} from "@/shared/components/table";
import { Badge } from "@/shared/components/badge";
import { TableToolbar } from "@/shared/components/table-toolbar";
import { Pagination } from "@/shared/components/table-pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/select";

interface AdminAttendeeRow {
  user_id: number;
  full_name: string;
  email: string;
  ticket_status: "issued" | "checked_in" | "cancelled";
  issued_at: string;
  checked_in_at: string | null;
  survey: { sent: boolean; responded: boolean } | null;
  can_check_in: boolean;
  can_cancel: boolean;
  can_resend_ticket: boolean;
  can_send_survey: boolean;
}

interface ManageResponse {
  attendees: AdminAttendeeRow[];
  total: number;
  page: number;
  limit: number;
  survey_sendable: boolean;
}

type StatusFilter = "all" | "checked_in" | "not_checked_in";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "checked_in", label: "Checked in" },
  { value: "not_checked_in", label: "Not checked in" },
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AdminAttendeeManagement({ eventId }: { eventId: string }) {
  const [attendees, setAttendees] = useState<AdminAttendeeRow[]>([]);
  const [total, setTotal] = useState(0);
  const [surveySendable, setSurveySendable] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState<AdminAttendeeRow | null>(null);

  const pageSize = 15;

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/events/${eventId}/attendees/manage?${params}`);
      if (res.ok && !ignore) {
        const data = (await res.json()) as ManageResponse;
        setAttendees(data.attendees);
        setTotal(data.total);
        setSurveySendable(data.survey_sendable);
        setError(null);
      } else if (!ignore) {
        setError("Failed to load attendees");
      }
      if (!ignore) setLoading(false);
    }
    load();

    return () => {
      ignore = true;
    };
  }, [eventId, page, search, statusFilter, refreshKey]);

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleStatusFilter(filter: StatusFilter) {
    setStatusFilter(filter);
    setPage(1);
  }

  async function run(action: string, url: string, confirmMessage?: string) {
    if (confirmMessage && !confirm(confirmMessage)) return;
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? `Failed to ${action}`);
        return;
      }
      setRefreshKey((k) => k + 1);
    } catch {
      setError(`Failed to ${action}`);
    } finally {
      setBusy(null);
    }
  }

  const isBusy = (key: string) => busy === key;

  const statusBadge = (attendee: AdminAttendeeRow) => {
    if (attendee.ticket_status === "checked_in") {
      return (
        <Badge variant="success">
          Checked in
          {attendee.checked_in_at ? ` · ${formatTime(attendee.checked_in_at)}` : ""}
        </Badge>
      );
    }
    if (attendee.ticket_status === "cancelled") {
      return <Badge variant="error">Cancelled</Badge>;
    }
    return <Badge>Registered</Badge>;
  };

  const surveyBadge = (attendee: AdminAttendeeRow) => {
    if (attendee.survey?.responded) return <Badge variant="success">Responded</Badge>;
    if (attendee.survey?.sent) return <Badge variant="info">Sent</Badge>;
    return <span className="text-muted-fg">—</span>;
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3">
        <h2 className="text-sm font-bold text-fg">Registered users</h2>
      </div>

      <TableToolbar search={{ value: search, onChange: handleSearch, placeholder: "Search name or email..." }} className="mb-3">
        <Select value={statusFilter} onValueChange={(v) => handleStatusFilter(v as StatusFilter)}>
          <SelectTrigger>
            <SelectValue>{STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label ?? "All"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableToolbar>

      {error && <p className="mb-3 text-xs text-error">{error}</p>}

      {attendees.length > 0 && !surveySendable && (
        <p className="mb-3 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-fg">
          Survey sends are unavailable &mdash; enable surveys for this event, wait for it to end, then send once from the
          Surveys tab.
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <span className="material-symbols-rounded animate-spin text-2xl text-brand">progress_activity</span>
        </div>
      ) : attendees.length === 0 ? (
        <TableEmpty
          icon="group"
          title="No attendees found"
          hint={search ? "Try a different search term." : "No attendees match the current filter."}
        />
      ) : (
        <>
          <TableContainer className="flex-1 overflow-auto">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeadCell>Attendee</TableHeadCell>
                  <TableHeadCell>Status</TableHeadCell>
                  <TableHeadCell>Survey</TableHeadCell>
                  <TableHeadCell className="w-12" aria-label="Actions" />
                </TableRow>
              </TableHead>
              <TableBody>
                {attendees.map((attendee) => (
                  <TableRow
                    key={attendee.user_id}
                    onClick={() => setSelected(attendee)}
                    aria-label={`Manage ${attendee.full_name}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="grid size-6 shrink-0 place-items-center rounded-full bg-brand/10 text-[10px] font-bold text-brand">
                          {getInitials(attendee.full_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-fg">{attendee.full_name}</p>
                          <p className="truncate text-[10px] text-muted-fg">{attendee.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{statusBadge(attendee)}</TableCell>
                    <TableCell>{surveyBadge(attendee)}</TableCell>
                    <TableCell className="w-12">
                      <span aria-hidden className="material-symbols-rounded text-base text-muted-fg">
                        chevron_right
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} className="mt-4" />
        </>
      )}

      <Drawer
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected?.full_name ?? ""}
        description={selected?.email}
        footer={
          selected && (
            <div className="flex flex-wrap items-center gap-2">
              {selected.can_check_in && (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={isBusy("checkin")}
                  onClick={() => run("check in", `/api/events/${eventId}/attendees/${selected.user_id}/checkin`)}
                >
                  {isBusy("checkin") ? "Checking in..." : "Check in"}
                </Button>
              )}
              {selected.can_send_survey && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={isBusy("survey")}
                  onClick={() => run("send survey", `/api/events/${eventId}/attendees/${selected.user_id}/survey`)}
                >
                  {isBusy("survey") ? "Sending..." : "Send survey"}
                </Button>
              )}
              {selected.can_resend_ticket && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isBusy("resend")}
                  onClick={() => run("resend ticket", `/api/events/${eventId}/attendees/${selected.user_id}/resend-ticket`)}
                >
                  {isBusy("resend") ? "Resending..." : "Resend ticket"}
                </Button>
              )}
              {selected.can_cancel && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-error hover:bg-error/10"
                  disabled={isBusy("cancel")}
                  onClick={() =>
                    run(
                      "cancel",
                      `/api/events/${eventId}/attendees/${selected.user_id}/cancel`,
                      `Cancel ${selected.full_name}'s registration? This cannot be undone.`,
                    )
                  }
                >
                  {isBusy("cancel") ? "Cancelling..." : "Cancel"}
                </Button>
              )}
            </div>
          )
        }
      >
        {selected && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                {getInitials(selected.full_name)}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-fg">{selected.full_name}</p>
                <p className="truncate text-xs text-muted-fg">{selected.email}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-fg">Ticket status</span>
              {statusBadge(selected)}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-fg">Survey</span>
              {surveyBadge(selected)}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-fg">Issued</span>
              <span>{formatShortDate(selected.issued_at)}</span>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
