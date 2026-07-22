"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
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
  venue_address: string | null;
  status: "draft" | "active" | "complete";
  cover_image_url: string | null;
  COURSE: Course | null;
}

type FilterTab = "upcoming" | "completed" | "drafts";

const FACILITATOR_TABS: { key: FilterTab; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
  { key: "drafts", label: "Drafts" },
];

const ATTENDEE_TABS: { key: FilterTab; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
];

export default function EventsPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>("upcoming");
  const [dbRole, setDbRole] = useState<string | null>(null);

  const isFacilitator = dbRole === "facilitator";

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.role) setDbRole(data.role);
      })
      .catch(() => {});
  }, [isSignedIn]);

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

  const filterTabs = isFacilitator ? FACILITATOR_TABS : ATTENDEE_TABS;

  return (
    <>
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-base font-bold text-foreground">Event list</span>
        </div>

        <div className="mb-3 flex gap-1.5">
          {filterTabs.map((tab) => (
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
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                coverImageUrl={event.cover_image_url}
                accentIndex={index}
                showEdit={isFacilitator}
              />
            ))}
          </div>
        )}
      </div>
      <Footer role={isFacilitator ? "facilitator" : "attendee"} />
    </>
  );
}
