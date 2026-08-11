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

const ATTENDEE_TABS: { key: FilterTab; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
];

export function EventListPage() {
  const router = useRouter();
  const { user } = useSession();
  const { filteredEvents, loading, loadingMore, error, hasMore, loadMore, activeTab, setActiveTab, tabCounts } = useEventList();

  useEffect(() => {
    if (user && user.role !== ROLES.ATTENDEE) {
      router.replace(roleHome(user.role));
    }
  }, [user, router]);

  if (loading) {
    return <EventListSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-destructive">{error}</div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-base font-bold text-foreground">Event list</span>
        </div>

        <div className="mb-3 flex gap-1.5">
          {ATTENDEE_TABS.map((tab) => (
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

        {filteredEvents.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="text-sm text-muted-foreground">No events found.</div>
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
                coverImageUrl={event.cover_image_url}
                accentIndex={index}
              />
            ))}
          </div>
        )}
        {hasMore && <LoadMoreButton loading={loadingMore} onLoadMore={loadMore} />}
      </div>
    </>
  );
}
