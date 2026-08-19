"use client";

import Link from "next/link";
import { ROLES } from "@/shared/lib/roles";
import { EventTable } from "@/modules/events/components/event-table";
import { useEventList } from "@/modules/events/lib/use-event-list";
import type { FilterTab } from "@/modules/events/lib/use-event-list";
import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import { LoadMoreButton } from "@/shared/components/load-more";
import { buttonStyles } from "@/shared/components/button";
import { TableToolbar } from "@/shared/components/table-toolbar";
import { StaffPage, StaffPageHeader, StaffPageState } from "@/shared/components/staff-page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/select";

const STATUS_OPTIONS: { value: FilterTab; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
  { value: "drafts", label: "Drafts" },
];

export function StaffEventListPage() {
  const { allowed, pending } = useRoleGuard(ROLES.ADMIN);
  const {
    events,
    filteredEvents,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore,
    loadMore,
    activeTab,
    setActiveTab,
    search,
    setSearch,
  } = useEventList();

  if (pending) {
    return <StaffPageState>Loading events...</StaffPageState>;
  }

  // Only blank the page when there is nothing to fall back on; a failed search
  // keeps the last loaded rows on screen instead.
  if (error && events.length === 0) {
    return <StaffPageState tone="error">{error}</StaffPageState>;
  }

  if (!allowed) return null;

  return (
    <StaffPage>
      <StaffPageHeader
        title="Events"
        description="Create, publish and manage your events."
        actions={
          <Link href="/staff/events/new" prefetch={false} className={buttonStyles({ size: "lg" })}>
            <span className="material-symbols-rounded text-[18px]">add</span>
            Create Event
          </Link>
        }
      />

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
        <p className="mt-2 text-sm text-error">Failed to refresh events — showing last loaded results.</p>
      )}

      <EventTable events={filteredEvents} showEdit loading={loading || refreshing} />

      {hasMore && <LoadMoreButton loading={loadingMore} onLoadMore={loadMore} />}
    </StaffPage>
  );
}
