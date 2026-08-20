"use client";

import { cn } from "@/shared/lib/utils";
import { EventCard } from "@/modules/events/components/event-card";
import { FeaturedEventCard } from "@/modules/events/components/featured-event-card";
import { featuredEvent } from "@/modules/events/lib/featured-event";
import { useSpeakerEvents } from "@/modules/events/lib/use-speaker-events";
import { EventListSkeleton } from "@/modules/events/components/event-list-skeleton";
import type { SpeakerFilter } from "@/modules/events/lib/use-speaker-events";

const FILTER_TABS: { key: SpeakerFilter; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Finished" },
  { key: "drafts", label: "Drafts" },
];

const EMPTY_MESSAGES: Record<SpeakerFilter, string> = {
  upcoming: "No upcoming engagements.",
  completed: "No finished engagements.",
  drafts: "No draft engagements.",
};

export function SpeakerEventListPage() {
  const { activeTab, setActiveTab, events, loading, upcoming, error } = useSpeakerEvents();
  // The featured card reads the always-loaded upcoming view, so it survives
  // every tab switch and even a failed fetch elsewhere.
  const featured = upcoming.loading ? null : featuredEvent(upcoming.events);

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <div className="flex flex-1 flex-col px-16 pt-24 pb-12">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-fg">My Engagements</h1>
        </div>

        {featured && (
          <div className="mb-8">
            <FeaturedEventCard event={featured} />
          </div>
        )}

        <div role="tablist" aria-label="Engagement status" className="mb-6 flex gap-1.5">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs transition-colors",
                activeTab === tab.key ? "bg-muted font-medium text-fg" : "text-muted-fg hover:bg-muted hover:text-fg",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* A failed refetch that still has rows behind it warns in place instead
            of throwing the list away — the same reason the hook keeps them. */}
        {error && events.length > 0 && (
          <p className="mb-3 text-sm text-error">Failed to refresh engagements — showing last loaded results.</p>
        )}

        {loading && events.length === 0 ? (
          <EventListSkeleton />
        ) : error && events.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <p className="text-sm text-error">{error}</p>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <p className="text-sm text-muted-fg">{EMPTY_MESSAGES[activeTab]}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event, index) => (
              <EventCard
                key={event.event_id}
                eventId={event.event_id}
                title={event.title}
                status={event.status}
                date={event.event_date}
                startTime={event.start_time}
                endTime={event.end_time}
                venueName={event.venue_name}
                eventType={event.event_type}
                accentIndex={index}
                detailHref={`/speaker/events/${event.event_id}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
