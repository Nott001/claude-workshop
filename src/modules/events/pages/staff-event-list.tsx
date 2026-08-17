"use client";

import Link from "next/link";
import { ROLES } from "@/shared/lib/roles";
import { EventTable } from "@/modules/events/components/event-table";
import { useEventList } from "@/modules/events/lib/use-event-list";
import type { FilterTab } from "@/modules/events/lib/use-event-list";
import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import { LoadMoreButton } from "@/shared/components/load-more";
import { TableToolbar } from "@/shared/components/table-toolbar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/select";

const STATUS_OPTIONS: { value: FilterTab; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
  { value: "drafts", label: "Drafts" },
];

export function StaffEventListPage() {
  const { allowed, pending } = useRoleGuard(ROLES.ADMIN);
  const { events, filteredEvents, loading, loadingMore, error, hasMore, loadMore, activeTab, setActiveTab, search, setSearch } =
    useEventList();

  if (pending) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Loading events...</div>
      </div>
    );
  }

  // Only blank the page when there is nothing to fall back on; a failed search
  // keeps the last loaded rows on screen instead.
  if (error && events.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-destructive">{error}</div>
      </div>
    );
  }

  if (!allowed) return null;

  return (
    <>
      <div className="flex flex-1 flex-col bg-bg px-5 py-12 sm:px-8 md:px-12">
        <div className="mx-auto w-full max-w-[1024px]">
          <div className="mb-8 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-info/10 p-2">
                <span className="material-symbols-rounded text-[24px] text-brand">event</span>
              </div>
              <div>
                <h1 className="text-[36px] leading-[40px] font-bold tracking-[-0.02em] text-fg">Events</h1>
                <p className="mt-1 text-sm text-muted-fg">Create, publish and manage your events.</p>
              </div>
            </div>
            <Link
              href="/staff/events/new"
              prefetch={false}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand/90"
            >
              <span className="material-symbols-rounded text-[18px]">add</span>
              Create Event
            </Link>
          </div>

          <TableToolbar search={{ value: search, onChange: setSearch, placeholder: "Search events" }}>
            <Select value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)}>
              <SelectTrigger>
                <SelectValue>{STATUS_OPTIONS.find((o) => o.value === activeTab)?.label ?? "Upcoming"}</SelectValue>
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

          {error && events.length > 0 && (
            <p className="mt-2 text-sm text-destructive">Failed to refresh events — showing last loaded results.</p>
          )}

          <EventTable events={filteredEvents} showEdit loading={loading} />

          {hasMore && <LoadMoreButton loading={loadingMore} onLoadMore={loadMore} />}
        </div>
      </div>
    </>
  );
}
