"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AttendeesPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const { isLoaded, isSignedIn } = useUser();

  const [userRole, setUserRole] = useState<string | null>(null);
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
    if (!isLoaded || !isSignedIn) return;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setUserRole(data.role);
        if (data.role !== "facilitator") {
          router.push("/");
        }
      });
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (userRole !== "facilitator") return;
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
  }, [eventId, userRole, page, search, statusFilter, refreshKey]);

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

  if (userRole !== "facilitator") return null;

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-6">
        <button
          onClick={() => router.push("/kiosk")}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="material-symbols-rounded text-[16px]">arrow_back</span>
          Back to Kiosk
        </button>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">View Attendees</h1>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {(["all", "checked_in", "not_checked_in"] as StatusFilter[]).map((filter) => (
            <button
              key={filter}
              onClick={() => handleStatusFilter(filter)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                statusFilter === filter ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {STATUS_LABELS[filter]}
            </button>
          ))}
        </div>
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="material-symbols-rounded animate-spin text-3xl text-primary">progress_activity</span>
        </div>
      ) : attendees.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/30 px-6 py-12 text-center">
          <span className="material-symbols-rounded mb-2 text-3xl text-muted-foreground">group</span>
          <p className="text-sm font-medium text-foreground">No attendees found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {search ? "Try a different search term." : "No attendees match the current filter."}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Registered</th>
                  <th className="px-4 py-3">Checked In</th>
                </tr>
              </thead>
              <tbody>
                {attendees.map((attendee) => (
                  <tr key={attendee.user_id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid size-8 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {getInitials(attendee.full_name)}
                        </div>
                        <span className="font-medium">{attendee.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{attendee.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          attendee.ticket_status === "checked_in"
                            ? "bg-[#2ea86e]/10 text-[#2ea86e]"
                            : attendee.ticket_status === "cancelled"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        {attendee.ticket_status === "checked_in"
                          ? "Checked in"
                          : attendee.ticket_status === "cancelled"
                            ? "Cancelled"
                            : "Registered"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(attendee.issued_at)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {attendee.checked_in_at ? formatTime(attendee.checked_in_at) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} attendees
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
