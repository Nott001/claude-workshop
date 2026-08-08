"use client";

import { ROLES } from "@/shared/lib/roles";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/modules/auth/components/session-context";
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

const PAGE_SIZE = 50;

export function useEventList() {
  const { user } = useSession();
  const isFacilitator = hasMinRole(user?.role ?? null, ROLES.FACILITATOR);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>("upcoming");
  const pageRef = useRef(1);

  const load = useCallback(async (page: number): Promise<{ rows: Event[]; hasMore: boolean; ok: boolean }> => {
    try {
      const res = await fetch(`/api/events?page=${page}&limit=${PAGE_SIZE}`);
      if (!res.ok) return { rows: [], hasMore: false, ok: false };
      const data = await res.json();
      const rows = (Array.isArray(data.data) ? data.data : []) as Event[];
      return { rows, hasMore: (data.total ?? 0) > page * PAGE_SIZE, ok: true };
    } catch {
      // A rejected request or a body that is not JSON leaves the page on an
      // error rather than stranded on the loading skeleton forever.
      return { rows: [], hasMore: false, ok: false };
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    pageRef.current = 1;

    async function loadFirstPage() {
      setLoading(true);
      setError(null);
      const result = await load(1);
      // Not on a superseded run: that one leaves every flag to its replacement.
      // Guarding only `loading` let the discarded run's data still land.
      if (cancelled) return;
      if (!result.ok) setError("Failed to load events");
      setEvents(result.rows);
      setHasMore(result.hasMore);
      setLoading(false);
    }

    loadFirstPage();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    const next = pageRef.current + 1;
    pageRef.current = next;
    const result = await load(next);
    if (!result.ok) setError("Failed to load events");
    setEvents((prev) => [...prev, ...result.rows]);
    setHasMore(result.hasMore);
    setLoadingMore(false);
  }, [load, loadingMore]);

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

  return {
    events,
    filteredEvents,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    activeTab,
    setActiveTab,
    isFacilitator,
    tabCounts,
  };
}
