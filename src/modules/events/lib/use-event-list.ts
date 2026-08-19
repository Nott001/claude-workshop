"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDebouncedValue } from "@/shared/lib/use-debounced-value";
import type { EventMode } from "@/shared/types";

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
  event_type?: EventMode | null;
  cover_image_url: string | null;
  COURSE: Course | null;
  attendee_count?: number;
  /** Seat cap, or null when uncapped. Read by the staff table's attendance cell. */
  capacity?: number | null;
}

export type FilterTab = "upcoming" | "completed" | "drafts";

const PAGE_SIZE = 50;

/**
 * What each tab asks the server for.
 *
 * The tabs used to be a client-side filter over one unscoped page of fifty, so
 * a tab showed only the events of its kind that happened to fall in those fifty
 * rows — with fifty upcoming events on the books, Completed rendered empty while
 * the archive sat there in full. Each tab now paginates over its own set.
 *
 * Upcoming and Completed are windows on the calendar, not status values: a past
 * `active` event is served as complete without its column ever being advanced,
 * because `effectiveEventStatus` derives that from the end time. Asking for
 * `status=complete` would miss every one of those. The status set rides along
 * only to keep drafts out, since they have a tab of their own.
 *
 * Drafts is the exception and really is a status — a draft sits on either side
 * of today, so a date window would hide half of them.
 */
function tabQuery(tab: FilterTab, includeDrafts: boolean): { filter?: string; status?: string } {
  switch (tab) {
    case "upcoming":
      return { filter: "upcoming", status: includeDrafts ? "active,draft" : "active" };
    case "completed":
      return { filter: "past", status: "active,complete" };
    case "drafts":
      return { status: "draft" };
  }
}
interface UseEventListOptions {
  /**
   * Include drafts under Upcoming. The general listing keeps drafts in their
   * own tab, but a facilitator's assigned view must not hide an unpublished
   * event they have been assigned to run.
   */
  upcomingIncludesDrafts?: boolean;
}

export function useEventList(options?: UseEventListOptions) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [activeTab, setActiveTab] = useState<FilterTab>("upcoming");
  const [search, setSearch] = useState("");
  const pageRef = useRef(1);
  // Whether a first page has ever landed. A skeleton answers "there is nothing
  // here yet"; once rows exist, tearing them down to say so again is the flicker
  // a search felt like. After this flips, a refetch keeps the current rows up
  // and reports itself through `refreshing` instead. Not derived from
  // `events.length`, or a search matching nothing would arm the skeleton for
  // the next keystroke.
  const loadedOnceRef = useRef(false);

  // Trimmed so a trailing space doesn't change the query and trigger a
  // spurious refetch; the raw value still shows in the input.
  const debouncedSearch = useDebouncedValue(search.trim());

  // Read off `options` once, as a primitive. Every caller passes an object
  // literal, so depending on the option through `options?.` gave the fetch a
  // dependency with a new identity on every render.
  const includeDrafts = options?.upcomingIncludesDrafts === true;

  const load = useCallback(
    async (page: number): Promise<{ rows: Event[]; hasMore: boolean; ok: boolean; total: number }> => {
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
        const scope = tabQuery(activeTab, includeDrafts);
        if (scope.filter) params.set("filter", scope.filter);
        if (scope.status) params.set("status", scope.status);
        if (debouncedSearch) params.set("search", debouncedSearch);
        const res = await fetch(`/api/events?${params}`);
        if (!res.ok) return { rows: [], hasMore: false, ok: false, total: 0 };
        const data = await res.json();
        const rows = (Array.isArray(data.data) ? data.data : []) as Event[];
        const total = data.total ?? 0;
        return { rows, hasMore: total > page * PAGE_SIZE, ok: true, total };
      } catch {
        // A rejected request or a body that is not JSON leaves the page on an
        // error rather than stranded on the loading skeleton forever.
        return { rows: [], hasMore: false, ok: false, total: 0 };
      }
    },
    [debouncedSearch, activeTab, includeDrafts],
  );

  useEffect(() => {
    let cancelled = false;
    pageRef.current = 1;

    async function loadFirstPage() {
      if (loadedOnceRef.current) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const result = await load(1);
      // Not on a superseded run: that one leaves every flag to its replacement.
      // Guarding only `loading` let the discarded run's data still land.
      if (cancelled) return;
      if (!result.ok) {
        // Keep the rows already on screen: wiping them on a failed search is
        // the whole-page blanking this refetch path exists to avoid.
        setError("Failed to load events");
        setHasMore(false);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      setEvents(result.rows);
      setHasMore(result.hasMore);
      setTotal(result.total);
      loadedOnceRef.current = true;
      setLoading(false);
      setRefreshing(false);
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

  const isUpcoming = (event: Event) => event.status === "active" || (includeDrafts && event.status === "draft");

  const filteredEvents = events.filter((event) => {
    switch (activeTab) {
      case "upcoming":
        return isUpcoming(event);
      case "completed":
        return event.status === "complete";
      case "drafts":
        return event.status === "draft";
      default:
        return true;
    }
  });

  return {
    events,
    filteredEvents,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore,
    loadMore,
    activeTab,
    setActiveTab,
    /** How many events the active tab holds in total, not just on the page fetched. */
    total,
    search,
    setSearch,
  };
}
