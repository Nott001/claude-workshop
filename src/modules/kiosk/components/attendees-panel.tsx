"use client";

import { useEffect, useState } from "react";
import { subscribeToCheckins, unsubscribe } from "@/shared/integrations/realtime";
import { useDebouncedValue } from "@/shared/lib/use-debounced-value";
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
import { TableSearch, FilterTabs, type FilterTab } from "@/shared/components/table-toolbar";
import { Pagination } from "@/shared/components/table-pagination";
import { Drawer } from "@/shared/components/drawer";

interface Attendee {
  user_id: number;
  full_name: string;
  email: string;
  ticket_status: "issued" | "checked_in" | "cancelled";
  issued_at: string;
  checked_in_at: string | null;
}

type StatusFilter = "all" | "checked_in" | "not_checked_in";

const STATUS_TABS: FilterTab<StatusFilter>[] = [
  { key: "all", label: "All" },
  { key: "checked_in", label: "Checked in" },
  { key: "not_checked_in", label: "Not checked in" },
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

export function AttendeesPanel({ eventId }: { eventId: string }) {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState<Attendee | null>(null);

  const pageSize = 15;

  // Debounced server-side search: keystrokes update the input immediately but
  // only settle into a fetch after the pause, so each search term triggers one
  // request. Trimmed so a trailing space doesn't produce a spurious refetch.
  const debouncedSearch = useDebouncedValue(search.trim());

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
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
  }, [eventId, page, debouncedSearch, statusFilter, refreshKey]);

  // Deliberately keyed on eventId only: the subscription must survive drawer
  // open/close, so `selected` must not appear in these deps.
  useEffect(() => {
    if (!eventId) return;
    const sub = subscribeToCheckins(Number(eventId), () => {
      setRefreshKey((k) => k + 1);
    });
    return () => {
      unsubscribe(sub);
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

  const statusBadge = (attendee: Attendee) => {
    if (attendee.ticket_status === "checked_in") return <Badge variant="success">Checked in</Badge>;
    if (attendee.ticket_status === "cancelled") return <Badge variant="error">Cancelled</Badge>;
    return <Badge>Registered</Badge>;
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3">
        <h2 className="text-sm font-bold text-fg">Attendees</h2>
      </div>

      <div className="mb-3 flex flex-col gap-3">
        <FilterTabs tabs={STATUS_TABS} active={statusFilter} onChange={handleStatusFilter} />
        <TableSearch value={search} onChange={handleSearch} placeholder="Search name or email..." />
      </div>

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
                  <TableHeadCell>Name</TableHeadCell>
                  <TableHeadCell>Status</TableHeadCell>
                  <TableHeadCell>Checked In</TableHeadCell>
                  <TableHeadCell className="w-12" aria-label="Actions" />
                </TableRow>
              </TableHead>
              <TableBody>
                {attendees.map((attendee) => (
                  <TableRow
                    key={attendee.user_id}
                    onClick={() => setSelected(attendee)}
                    aria-label={`View ${attendee.full_name}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="grid size-6 place-items-center rounded-full bg-brand/10 text-[10px] font-bold text-brand">
                          {getInitials(attendee.full_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-fg">{attendee.full_name}</p>
                          <p className="truncate text-[10px] text-muted-fg">{attendee.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{statusBadge(attendee)}</TableCell>
                    <TableCell className="text-muted-fg">
                      {attendee.checked_in_at ? formatTime(attendee.checked_in_at) : "\u2014"}
                    </TableCell>
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
              <span className="text-muted-fg">Issued</span>
              <span>{formatShortDate(selected.issued_at)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-fg">Checked in</span>
              <span>{selected.checked_in_at ? formatTime(selected.checked_in_at) : "—"}</span>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
