"use client";

import { ROLES } from "@/shared/lib/roles";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/shared/lib/utils";
import { EventCard } from "@/modules/events/components/event-card";
import { EventListSkeleton } from "@/modules/events/components/event-list-skeleton";
import { useSession } from "@/modules/auth/components/session-context";
import { roleHome } from "@/modules/auth/lib/role-home";
import { useEventList } from "@/modules/events/lib/use-event-list";
import type { FilterTab } from "@/modules/events/lib/use-event-list";
import { LoadMoreButton } from "@/shared/components/load-more";
import { TableSearch } from "@/shared/components/table-toolbar";

const ATTENDEE_TABS: { key: FilterTab; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
];

export function EventListPage() {
  const router = useRouter();
  const { user } = useSession();
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
  } = useEventList();

  useEffect(() => {
    if (user && user.role !== ROLES.ATTENDEE) {
      router.replace(roleHome(user.role));
    }
  }, [user, router]);

  const term = search.trim();
  const tabLabel = ATTENDEE_TABS.find((tab) => tab.key === activeTab)?.label.toLowerCase() ?? "";

  return (
    <div className="flex flex-1 flex-col p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-base font-bold text-fg">Event list</span>
      </div>

      {/* The heading, tabs and search sit outside every loading and error
          branch below. A refetch that unmounted them would drop the cursor out
          of the search box on the pause after each keystroke. */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Event status" className="flex gap-1.5">
          {ATTENDEE_TABS.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              // The counts are of what the search matched, not of the whole
              // calendar, so a term that hits the other tab says where it went
              // rather than leaving this one blank and unexplained.
              className={cn(
                "rounded-md px-2.5 py-1 text-xs transition-colors",
                activeTab === tab.key ? "bg-muted font-medium text-fg" : "text-muted-fg hover:bg-muted hover:text-fg",
              )}
            >
              {tab.label} ({tabCounts[tab.key]})
            </button>
          ))}
        </div>

        <TableSearch value={search} onChange={setSearch} placeholder="Search events" className="sm:w-72" />
      </div>

      {/* A failed refetch that still has rows behind it warns in place instead
          of throwing the list away — the same reason the hook keeps them. */}
      {error && filteredEvents.length > 0 && (
        <p className="mb-3 text-sm text-error">Failed to refresh events — showing the last results loaded.</p>
      )}

      {loading ? (
        <EventListSkeleton />
      ) : error && filteredEvents.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <p className="text-sm text-error">{error}</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <p className="text-sm text-muted-fg">{term ? `No ${tabLabel} events match “${term}”.` : "No events found."}</p>
        </div>
      ) : (
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map((event, index) => (
            <EventCard
              key={event.id}
              eventId={event.id}
              title={event.title}
              status={event.status}
              date={event.event_date}
              startTime={event.start_time}
              endTime={event.end_time}
              venueName={event.venue_name}
              eventType={event.event_type}
              coverImageUrl={event.cover_image_url}
              accentIndex={index}
            />
          ))}
        </div>
      )}

      {hasMore && <LoadMoreButton loading={loadingMore} onLoadMore={loadMore} />}
    </div>
  );
}
