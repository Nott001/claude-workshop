import type { LandingEvent } from "@/shared/types";
import { EventCard } from "@/modules/events/components/event-card";

export function EventGrid({ events }: { events: LandingEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-fg">No upcoming events.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {events.map((event, i) => (
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
          accentIndex={i}
        />
      ))}
    </div>
  );
}
