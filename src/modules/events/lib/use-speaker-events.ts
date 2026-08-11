"use client";

import { useEffect, useState } from "react";

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

export function useSpeakerEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchEvents() {
      setLoading(true);
      const res = await fetch("/api/speakers/me/events");
      if (!res.ok) {
        if (!cancelled) {
          setError("Failed to load events");
          setLoading(false);
        }
        return;
      }
      const data = await res.json();
      if (!cancelled) {
        setEvents(data);
        setLoading(false);
      }
    }

    fetchEvents();
    return () => {
      cancelled = true;
    };
  }, []);

  return { events, loading, error };
}
