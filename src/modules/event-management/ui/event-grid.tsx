import Link from "next/link";

import { EventCard } from "@/components/event-card";
import type { LandingEvent } from "@/lib/landing";

interface EventGridProps {
  events: LandingEvent[];
}

export function EventGrid({ events }: EventGridProps) {
  return (
    <section id="upcoming-events" className="bg-surface px-6 py-20 sm:px-12 lg:px-16">
      <div className="mx-auto max-w-[1110px]">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-[32px]">Upcoming Events</h2>
          <p className="mt-4 text-base leading-6 text-muted-fg">
            Live workshops and networking events designed to keep you at the forefront of business innovation.
          </p>
        </div>
        <div className={`mt-12 gap-6 ${events.length === 1 ? "grid" : "grid lg:grid-cols-2"}`}>
          {events.length === 1 ? (
            <div className="mx-auto w-full max-w-[66%] lg:col-span-2">
              <EventCard
                eventId={events[0].event_id}
                title={events[0].title}
                status={events[0].status}
                date={events[0].event_date}
                startTime={events[0].start_time}
                endTime={events[0].end_time}
                venueName={events[0].venue_name}
                coverImageUrl={events[0].cover_image_url}
                accentIndex={0}
              />
            </div>
          ) : (
            events.map((event, index) => (
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
              />
            ))
          )}
        </div>
        {events.length > 0 && (
          <div className="mt-12 text-center">
            <Link
              href="/events"
              className="inline-flex items-center gap-2 rounded-xl border border-brand px-8 py-3 text-sm font-semibold text-brand transition hover:bg-brand/5"
            >
              See All Upcoming Events <span className="material-symbols-rounded text-base">arrow_forward</span>
            </Link>
          </div>
        )}
        {events.length === 0 && (
          <div className="mt-12 text-center text-sm text-muted-fg">No upcoming events at the moment. Check back soon!</div>
        )}
      </div>
    </section>
  );
}
