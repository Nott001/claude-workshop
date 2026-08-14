"use client";

import { ROLES } from "@/shared/lib/roles";
import { EventTable } from "@/modules/events/components/event-table";
import { useEventList } from "@/modules/events/lib/use-event-list";
import type { FilterTab } from "@/modules/events/lib/use-event-list";
import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import { LoadMoreButton } from "@/shared/components/load-more";
import { TableSearch, FilterTabs } from "@/shared/components/table-toolbar";

const TABS: { key: FilterTab; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
];

export function AssignedEventListPage() {
  // Exact facilitator, not min-role: an admin clears a facilitator minimum, but
  // the server hands admins every event and this page must not leak that.
  const { allowed, pending } = useRoleGuard(ROLES.FACILITATOR, { exactRole: true });
  const {
    filteredEvents,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    activeTab,
    setActiveTab,
    tabCounts,
    search,
    setSearch,
  } = useEventList({
    upcomingIncludesDrafts: true,
  });

  if (pending || loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Loading events...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-destructive">{error}</div>
      </div>
    );
  }

  if (!allowed) return null;

  return (
    <>
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-base font-bold text-foreground">My Events</span>
        </div>

        <TableSearch value={search} onChange={setSearch} placeholder="Search events" className="mb-3 max-w-xs" />

        <div className="mb-3">
          <FilterTabs tabs={TABS} active={activeTab} onChange={setActiveTab} counts={tabCounts} />
        </div>

        <EventTable events={filteredEvents} showKiosk />

        {hasMore && <LoadMoreButton loading={loadingMore} onLoadMore={loadMore} />}
      </div>
    </>
  );
}
