"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { subscribeToCheckins } from "@/lib/realtime";

interface Attendee {
  user_id: number;
  full_name: string;
  email: string;
  ticket_status: "issued" | "checked_in" | "cancelled";
  issued_at: string;
  checked_in_at: string | null;
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

export function AttendeesPanel({ eventId }: { eventId: string }) {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const pageSize = 15;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/events/${eventId}/attendees?${params}`);
      if (res.ok && !ignore) {
        const data = await res.json();
        setAttendees(data.attendees);
        setTotal(data.total);
      }
      if (!ignore) setLoading(false);
    }
    load();

    return () => {
      ignore = true;
    };
  }, [eventId, page, search, statusFilter, refreshKey]);

  useEffect(() => {
    if (!eventId) return;
    const sub = subscribeToCheckins(Number(eventId), () => {
      setRefreshKey((k) => k + 1);
    });
    return () => {
      sub.unsubscribe();
    };
  }, [eventId]);

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleStatusFilter(filter: StatusFilter) {
    setStatusFilter(filter);
    setPage(1);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3">
        <h2 className="text-sm font-bold text-fg">Attendees</h2>
      </div>

      <div className="mb-3 flex flex-col gap-3">
        <div className="flex gap-1.5">
          {(["all", "checked_in", "not_checked_in"] as StatusFilter[]).map((filter) => (
            <button
              key={filter}
              onClick={() => handleStatusFilter(filter)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                statusFilter === filter ? "bg-brand/10 text-brand" : "bg-muted text-muted-fg hover:bg-muted"
              }`}
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
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Checked In</th>
                </tr>
              </thead>
              <tbody>
                {attendees.map((attendee) => (
                  <tr key={attendee.user_id} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="grid size-6 place-items-center rounded-full bg-brand/10 text-[10px] font-bold text-brand">
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
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          attendee.ticket_status === "checked_in"
                            ? "bg-success/10 text-success"
                            : attendee.ticket_status === "cancelled"
                              ? "bg-error/10 text-error"
                              : "bg-muted text-muted-fg"
                        }`}
                      >
                        {attendee.ticket_status === "checked_in"
                          ? "Checked in"
                          : attendee.ticket_status === "cancelled"
                            ? "Cancelled"
                            : "Registered"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-fg">
                      {attendee.checked_in_at ? formatTime(attendee.checked_in_at) : "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-2 flex items-center justify-between text-[10px] text-muted-fg">
            <span>
              {(page - 1) * pageSize + 1}\u2013{Math.min(page * pageSize, total)} of {total}
            </span>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="h-7 px-2 text-[10px]"
              >
                Prev
              </Button>
              <Button
                variant="outline"
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
