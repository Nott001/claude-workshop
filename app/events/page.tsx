"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

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
  venue_address: string | null;
  COURSE: Course | null;
}

export default function EventsPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchEvents(f: string) {
      setLoading(true);
      const url = f ? `/api/events?filter=${f}` : "/api/events";
      const res = await fetch(url);
      if (!res.ok) {
        if (!cancelled) setError("Failed to load events");
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (!cancelled) setEvents(data);
      setLoading(false);
    }

    fetchEvents(filter);
    return () => { cancelled = true; };
  }, [filter]);

  if (loading) return <div>Loading events...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div>
      <div>
        <h1>Events</h1>
        {isLoaded && isSignedIn && <button onClick={() => router.push("/events/new")}>Create Event</button>}
      </div>

      <div>
        <button onClick={() => setFilter("")}>All</button>
        <button onClick={() => setFilter("upcoming")}>Upcoming</button>
        <button onClick={() => setFilter("past")}>Past</button>
      </div>

      {events.length === 0 ? (
        <p>No events found.</p>
      ) : (
        <ul>
          {events.map((event) => (
            <li key={event.event_id}>
              <a
                href={`/events/${event.event_id}`}
                onClick={(e) => {
                  e.preventDefault();
                  router.push(`/events/${event.event_id}`);
                }}
              >
                <h2>{event.title}</h2>
                <p>
                  {event.event_date} | {event.start_time} - {event.end_time}
                </p>
                <p>
                  {event.venue_name}
                  {event.venue_address ? `, ${event.venue_address}` : ""}
                </p>
                {event.COURSE && <p>Course: {event.COURSE.course_name}</p>}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
