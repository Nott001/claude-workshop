"use client";

import { EventCard } from "@/modules/events/components/event-card";
import { Footer } from "@/shared/components/footer";
import { useSpeakerEvents } from "@/modules/events/lib/use-speaker-events";

export default function SpeakerDashboardPage() {
  const { events, loading, error } = useSpeakerEvents();

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Loading engagements...</div>
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

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <div className="flex flex-1 flex-col px-16 pt-24 pb-12">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">Upcoming Engagements</h1>
        </div>

        {events.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <p className="text-sm text-muted-foreground">No upcoming engagements.</p>
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
                courseName={event.COURSE?.course_name ?? undefined}
                accentIndex={index}
                detailHref={`/speakers/dashboard/${event.event_id}`}
              />
            ))}
          </div>
        )}
      </div>
      <Footer role="speaker" />
    </div>
  );
}
