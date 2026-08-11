"use client";

import { ROLES } from "@/shared/lib/roles";
import { cn } from "@/shared/lib/utils";
import { EventTable } from "@/modules/events/components/event-table";
import { useEventList } from "@/modules/events/lib/use-event-list";
import type { FilterTab } from "@/modules/events/lib/use-event-list";
import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import { LoadMoreButton } from "@/shared/components/load-more";

const TABS: { key: FilterTab; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
  { key: "drafts", label: "Drafts" },
];

export function StaffEventListPage() {
  const { allowed, pending } = useRoleGuard(ROLES.ADMIN);
  const { filteredEvents, loading, loadingMore, error, hasMore, loadMore, activeTab, setActiveTab, tabCounts } = useEventList();

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
          <span className="text-base font-bold text-foreground">Events</span>
        </div>

        <div className="mb-3 flex gap-1.5">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs transition-colors",
                activeTab === tab.key
                  ? "bg-surface-hover font-medium text-foreground"
                  : "text-muted-foreground hover:bg-surface-hover",
              )}
            >
              {tab.label} ({tabCounts[tab.key]})
            </button>
          ))}
        </div>

        <EventTable events={filteredEvents} showEdit />

        {hasMore && <LoadMoreButton loading={loadingMore} onLoadMore={loadMore} />}
      </div>
    </>
  );
}
