"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/shared/lib/utils";
import { EventCard } from "@/modules/events/components/event-card";
import { Footer } from "@/shared/components/footer";
import { useEventList } from "@/modules/events/lib/use-event-list";
import type { FilterTab } from "@/modules/events/lib/use-event-list";
import { hasMinRole } from "@/shared/lib/role-hierarchy";

const FACILITATOR_TABS: { key: FilterTab; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
  { key: "drafts", label: "Drafts" },
];

const NON_FACILITATOR_TABS: { key: FilterTab; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
];

export default function StaffEventsPage() {
  const router = useRouter();
  const { filteredEvents, loading, error, activeTab, setActiveTab, isFacilitator, userRole, tabCounts } = useEventList();

  useEffect(() => {
    if (loading || error) return;
    if (!hasMinRole(userRole, "facilitator")) {
      router.replace("/access-denied");
    }
  }, [userRole, router, loading, error]);

  if (loading) {
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

  if (!hasMinRole(userRole, "facilitator")) return null;

  const filterTabs = isFacilitator ? FACILITATOR_TABS : NON_FACILITATOR_TABS;

  return (
    <>
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-base font-bold text-foreground">Events</span>
        </div>

        <div className="mb-3 flex gap-1.5">
          {filterTabs.map((tab) => (
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
                key={event.event_id}
                eventId={event.event_id}
                title={event.title}
                status={event.status}
                date={event.event_date}
                startTime={event.start_time}
                endTime={event.end_time}
                venueName={event.venue_name}
                coverImageUrl={event.cover_image_url}
                accentIndex={index}
                showEdit={isFacilitator}
                detailHref={`/staff/events/${event.event_id}`}
              />
            ))}
          </div>
        )}
      </div>
      <Footer role={userRole as "facilitator" | "speaker" | "attendee"} />
    </>
  );
}
