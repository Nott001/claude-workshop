import type { LandingEvent } from "@/shared/types";
import { withBackLink, type BackLinkOrigin } from "@/shared/lib/back-link";
import { EventCard } from "@/modules/events/components/event-card";

/** `backOrigin` names the page holding the grid, so the detail page it opens
 *  can offer a way back to it rather than to the events list. */
export function EventGrid({ events, backOrigin }: { events: LandingEvent[]; backOrigin?: BackLinkOrigin }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-fg">No upcoming events.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {events.map((event, i) => (
        <EventCard
          key={event.event_id}
          eventId={event.event_id}
          detailHref={withBackLink(`/events/${event.event_id}`, backOrigin)}
          title={event.title}
          status={event.status}
          date={event.event_date}
          startTime={event.start_time}
          endTime={event.end_time}
          venueName={event.venue_name}
          eventType={event.event_type}
          coverImageUrl={event.cover_image_url}
          accentIndex={i}
        />
      ))}
    </div>
  );
}
