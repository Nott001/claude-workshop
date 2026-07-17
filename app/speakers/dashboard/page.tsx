"use client";

import { useEffect, useState } from "react";
import { EventCard } from "@/components/event-card";
import { Footer } from "@/components/footer";

interface Course {
  course_name: string;
}

interface Event {
  event_id: number;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  status: string;
  COURSE: Course | null;
}

export default function SpeakerDashboardPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchEvents() {
      setLoading(true);
      const res = await fetch("/api/speakers/me/events");
      if (!res.ok) {
        if (!cancelled) setError("Failed to load events");
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (!cancelled) setEvents(data);
      setLoading(false);
    }

    fetchEvents();
    return () => {
      cancelled = true;
    };
  }, []);

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
    <div className="flex min-h-screen flex-col bg-[#fbf9f8]">
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
