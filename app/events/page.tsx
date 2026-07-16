"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { EventCard } from "@/components/event-card";

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
  status: "draft" | "active" | "complete";
  cover_image_url: string | null;
  COURSE: Course | null;
}

type FilterTab = "active" | "upcoming" | "completed" | "drafts";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
  { key: "drafts", label: "Drafts" },
];

export default function EventsPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>("active");

  const userRole = (user?.publicMetadata?.role as string) || "attendee";
  const isFacilitator = userRole === "facilitator";

  useEffect(() => {
    let cancelled = false;

    async function fetchEvents() {
      setLoading(true);
      const res = await fetch("/api/events");
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

  const filteredEvents = events.filter((event) => {
    switch (activeTab) {
      case "active":
        return event.status === "active";
      case "upcoming":
        return event.status === "active" || event.status === "draft";
      case "completed":
        return event.status === "complete";
      case "drafts":
        return event.status === "draft";
      default:
        return true;
    }
  });

  const tabCounts = {
    active: events.filter((e) => e.status === "active").length,
    upcoming: events.filter((e) => e.status === "active" || e.status === "draft").length,
    completed: events.filter((e) => e.status === "complete").length,
    drafts: events.filter((e) => e.status === "draft").length,
  };

  async function handleDelete(eventId: number) {
    const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
    if (res.ok) {
      setEvents((prev) => prev.filter((e) => e.event_id !== eventId));
    }
  }

  if (!isLoaded || loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Loading events...</div>
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
    <div className="flex flex-1 flex-col p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-base font-bold text-foreground">Event list</span>
        {isSignedIn && isFacilitator && (
          <Link
            href="/events/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <span className="material-symbols-rounded text-sm">add_circle</span>
            Create event
          </Link>
        )}
      </div>

      <div className="mb-3 flex gap-1.5">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs transition-colors",
              activeTab === tab.key
                ? "bg-surface-hover font-medium text-foreground"
                : "text-muted-foreground hover:bg-surface-hover",
            )}
          >
            {tab.label} ({tabCounts[tab.key]})
          </button>
        ))}
      </div>

      {filteredEvents.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="text-sm text-muted-foreground">No events found.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map((event, index) => (
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
              coverImageUrl={event.cover_image_url}
              accentIndex={index}
              showEdit={isFacilitator}
              onDelete={isFacilitator ? handleDelete : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
