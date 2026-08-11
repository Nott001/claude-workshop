"use client";

import Link from "next/link";
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
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand/90"
            >
              <span className="material-symbols-rounded text-[18px]">add</span>
              Create Event
            </Link>
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
      </div>
    </>
  );
}
