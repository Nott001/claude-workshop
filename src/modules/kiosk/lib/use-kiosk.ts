"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/modules/auth";
import type { Event } from "@/types";

export function useKiosk() {
  const router = useRouter();
  const { loading: isLoaded, isSignedIn, user } = useSession();
  const userRole = user?.role ?? null;
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || userRole !== "facilitator") {
      router.push("/");
    }
  }, [isLoaded, isSignedIn, userRole, router]);

  useEffect(() => {
    if (userRole !== "facilitator") return;
    fetch("/api/events?filter=upcoming")
      .then((r) => (r.ok ? r.json() : Promise.reject("Failed to load events")))
      .then((data) => {
        if (Array.isArray(data)) setEvents(data);
      })
      .catch((err) => setEventsError(typeof err === "string" ? err : "Failed to load events"))
      .finally(() => setEventsLoading(false));
  }, [userRole]);

  return { isLoaded, userRole, events, eventsLoading, eventsError, selectedEvent, setSelectedEvent };
}
