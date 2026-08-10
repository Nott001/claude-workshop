"use client";

import { useEffect, useState } from "react";
import { getBadgeProps } from "@/modules/events/lib/schemas";

interface EventData {
  event_id: number;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  status: string;
  course_id: number | null;
  course_name: string | null;
  description: string | null;
  attendee_count: number;
}

export function useSpeakerEvent(eventId: string) {
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchEvent() {
      const res = await fetch(`/api/speakers/me/events/${eventId}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!cancelled) {
          setError(body?.error ?? "Failed to load event details");
          setLoading(false);
        }
        return;
      }
      const data = await res.json();
      if (!cancelled) {
        setEvent(data);
        setLoading(false);
      }
    }

    fetchEvent();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const badge = event ? getBadgeProps(event) : null;
  const isLive = badge?.status === "live";
  const isUpcoming = badge?.status === "upcoming";
  const isComplete = badge?.status === "completed";

  return { event, loading, error, badge, isLive, isUpcoming, isComplete };
}
