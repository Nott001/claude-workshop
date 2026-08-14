"use client";

import { useEffect, useState } from "react";
import { Input } from "@/shared/components/input";
import { Button } from "@/shared/components/button";
import { cn } from "@/shared/lib/utils";

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

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All",
  checked_in: "Checked in",
  not_checked_in: "Not checked in",
};

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

  const pageSize = 15;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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

  async function run(action: string, userId: number, url: string, confirmMessage?: string) {
    if (confirmMessage && !confirm(confirmMessage)) return;
    const key = `${action}:${userId}`;
    setBusy(key);
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

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3">
        <h2 className="text-sm font-bold text-fg">Registered users</h2>
      </div>

      <div className="mb-3 flex flex-col gap-3">
        <div className="flex gap-1.5">
          {(["all", "checked_in", "not_checked_in"] as StatusFilter[]).map((filter) => (
            <button
              key={filter}
              onClick={() => handleStatusFilter(filter)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors",
                statusFilter === filter ? "bg-brand/10 text-brand" : "bg-muted text-muted-fg hover:bg-muted",
              )}
            >
              {STATUS_LABELS[filter]}
            </button>
          ))}
        </div>
        <Input
          placeholder="Search name or email..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="h-9 text-xs"
        />
      </div>

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
        <div className="rounded-lg border border-border bg-muted px-4 py-8 text-center">
          <span className="material-symbols-rounded mb-1 text-2xl text-muted-fg">group</span>
          <p className="text-xs font-medium text-fg">No attendees found</p>
          <p className="mt-0.5 text-[10px] text-muted-fg">
            {search ? "Try a different search term." : "No attendees match the current filter."}
          </p>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted text-left text-[10px] font-semibold uppercase tracking-wider text-muted-fg">
                  <th className="px-3 py-2">Attendee</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Survey</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {attendees.map((attendee) => (
                  <tr key={attendee.user_id} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="grid size-6 shrink-0 place-items-center rounded-full bg-brand/10 text-[10px] font-bold text-brand">
                          {getInitials(attendee.full_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-fg">{attendee.full_name}</p>
                          <p className="truncate text-[10px] text-muted-fg">{attendee.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                          attendee.ticket_status === "checked_in"
                            ? "bg-success/10 text-success"
                            : attendee.ticket_status === "cancelled"
                              ? "bg-error/10 text-error"
                              : "bg-muted text-muted-fg",
                        )}
                      >
                        {attendee.ticket_status === "checked_in"
                          ? `Checked in ${attendee.checked_in_at ? `· ${formatTime(attendee.checked_in_at)}` : ""}`
                          : attendee.ticket_status === "cancelled"
                            ? "Cancelled"
                            : "Registered"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {attendee.survey?.responded ? (
                        <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                          Responded
                        </span>
                      ) : attendee.survey?.sent ? (
                        <span className="inline-flex items-center rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
                          Sent
                        </span>
                      ) : (
                        <span className="text-muted-fg">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        {attendee.can_check_in && (
                          <Button
                            variant="primary"
                            size="sm"
                            className="h-7 px-2 text-[10px]"
                            disabled={isBusy(`checkin:${attendee.user_id}`)}
                            onClick={() =>
                              run("check in", attendee.user_id, `/api/events/${eventId}/attendees/${attendee.user_id}/checkin`)
                            }
                          >
                            {isBusy(`checkin:${attendee.user_id}`) ? "Checking in..." : "Check in"}
                          </Button>
                        )}
                        {attendee.can_send_survey && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-7 px-2 text-[10px]"
                            disabled={isBusy(`survey:${attendee.user_id}`)}
                            onClick={() =>
                              run(
                                "send survey",
                                attendee.user_id,
                                `/api/events/${eventId}/attendees/${attendee.user_id}/survey`,
                              )
                            }
                          >
                            {isBusy(`survey:${attendee.user_id}`) ? "Sending..." : "Send survey"}
                          </Button>
                        )}
                        {attendee.can_resend_ticket && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[10px]"
                            disabled={isBusy(`resend:${attendee.user_id}`)}
                            onClick={() =>
                              run(
                                "resend ticket",
                                attendee.user_id,
                                `/api/events/${eventId}/attendees/${attendee.user_id}/resend-ticket`,
                              )
                            }
                          >
                            {isBusy(`resend:${attendee.user_id}`) ? "Resending..." : "Resend ticket"}
                          </Button>
                        )}
                        {attendee.can_cancel && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[10px] text-error hover:bg-error/10"
                            disabled={isBusy(`cancel:${attendee.user_id}`)}
                            onClick={() =>
                              run(
                                "cancel",
                                attendee.user_id,
                                `/api/events/${eventId}/attendees/${attendee.user_id}/cancel`,
                                `Cancel ${attendee.full_name}'s registration? This cannot be undone.`,
                              )
                            }
                          >
                            {isBusy(`cancel:${attendee.user_id}`) ? "Cancelling..." : "Cancel"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-2 flex items-center justify-between text-[10px] text-muted-fg">
            <span>
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
            </span>
            <div className="flex gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="h-7 px-2 text-[10px]"
              >
                Prev
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-7 px-2 text-[10px]"
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
