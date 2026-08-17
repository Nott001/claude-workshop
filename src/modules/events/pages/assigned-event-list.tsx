"use client";

import { ROLES } from "@/shared/lib/roles";
import { EventTable } from "@/modules/events/components/event-table";
import { useEventList } from "@/modules/events/lib/use-event-list";
import type { FilterTab } from "@/modules/events/lib/use-event-list";
import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import { LoadMoreButton } from "@/shared/components/load-more";
import { TableToolbar } from "@/shared/components/table-toolbar";
import { StaffPage, StaffPageHeader, StaffPageState } from "@/shared/components/staff-page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/select";

const STATUS_OPTIONS: { value: FilterTab; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
];

export function AssignedEventListPage() {
  // Exact facilitator, not min-role: an admin clears a facilitator minimum, but
  // the server hands admins every event and this page must not leak that.
  const { allowed, pending } = useRoleGuard(ROLES.FACILITATOR, { exactRole: true });
  const { filteredEvents, loading, loadingMore, error, hasMore, loadMore, activeTab, setActiveTab, search, setSearch } =
    useEventList({
      upcomingIncludesDrafts: true,
    });

  if (pending || loading) {
    return <StaffPageState>Loading events...</StaffPageState>;
  }

  if (error) {
    return <StaffPageState tone="error">{error}</StaffPageState>;
  }

  if (!allowed) return null;

  return (
    <StaffPage>
      <StaffPageHeader title="My Events" description="The events you are assigned to facilitate." />

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

      <EventTable events={filteredEvents} showKiosk />

      {hasMore && <LoadMoreButton loading={loadingMore} onLoadMore={loadMore} />}
    </StaffPage>
  );
}
