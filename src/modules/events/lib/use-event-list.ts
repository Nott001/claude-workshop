"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/modules/auth";
import { hasMinRole } from "@/shared/lib/role-hierarchy";

interface Course {
  course_name: string;
}

interface Event {
  id: number;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  venue_address: string | null;
  status: "draft" | "active" | "complete";
  cover_image_url: string | null;
  COURSE: Course | null;
}

export type FilterTab = "upcoming" | "completed" | "drafts";

export function useEventList() {
  const { user } = useSession();
  const isFacilitator = hasMinRole(user?.role ?? null, "facilitator");
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>("upcoming");

  useEffect(() => {
    let cancelled = false;

    async function fetchEvents() {
      setLoading(true);
      const res = await fetch("/api/events");
      // Bail on everything, `loading` included. Guarding only the data write let
      // a superseded run clear `loading` while the list was still empty, and the
      // page rendered its "No events found" empty state until the live run
      // landed. React's strict mode makes that the normal path in development:
      // it mounts, cleans up, and remounts every effect.
      if (cancelled) return;

      if (!res.ok) {
        setError("Failed to load events");
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (cancelled) return;

      setEvents(data);
      setLoading(false);
    }

    fetchEvents();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredEvents = events.filter((event) => {
    switch (activeTab) {
      case "upcoming":
        return event.status === "active";
      case "completed":
        return event.status === "complete";
      case "drafts":
        return event.status === "draft";
      default:
        return true;
    }
  });

  const tabCounts = {
    upcoming: events.filter((e) => e.status === "active").length,
    completed: events.filter((e) => e.status === "complete").length,
    drafts: events.filter((e) => e.status === "draft").length,
  };

  return { events, filteredEvents, loading, error, activeTab, setActiveTab, isFacilitator, tabCounts };
}
