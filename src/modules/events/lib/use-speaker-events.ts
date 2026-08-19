"use client";

import { useEffect, useRef, useState } from "react";
import type { LandingEvent } from "@/shared/types";

export type SpeakerFilter = "upcoming" | "completed" | "drafts";

interface SpeakerView {
  events: LandingEvent[];
  loading: boolean;
}

export function useSpeakerEvents() {
  const [activeTab, setActiveTab] = useState<SpeakerFilter>("upcoming");
  const [views, setViews] = useState<Record<SpeakerFilter, SpeakerView>>({
    upcoming: { events: [], loading: true },
    completed: { events: [], loading: false },
    drafts: { events: [], loading: false },
  });
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef<Record<SpeakerFilter, boolean>>({
    upcoming: false,
    completed: false,
    drafts: false,
  });

  useEffect(() => {
    // The upcoming view is fetched once on mount and kept for the featured
    // card; the other tabs load on first visit and are cached from then on.
    if (loadedRef.current[activeTab]) return;
    let cancelled = false;

    setError(null);
    setViews((prev) => ({ ...prev, [activeTab]: { events: prev[activeTab].events, loading: true } }));

    fetch(`/api/speakers/me/events?filter=${activeTab}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load events");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        // Mark the tab loaded only once the request has settled, success or
        // failure. Caching before the fetch left a dev-only gap: StrictMode
        // remounts the effect, the second run hit the guard and returned while
        // the first run's cancellation flag discarded the one fetch that fired
        // — the tab stayed loading forever.
        loadedRef.current[activeTab] = true;
        const events = (Array.isArray(data) ? data : []) as LandingEvent[];
        setViews((prev) => ({ ...prev, [activeTab]: { events, loading: false } }));
      })
      .catch(() => {
        if (cancelled) return;
        loadedRef.current[activeTab] = true;
        setError("Failed to load events");
        setViews((prev) => ({ ...prev, [activeTab]: { ...prev[activeTab], loading: false } }));
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  return {
    activeTab,
    setActiveTab,
    events: views[activeTab].events,
    loading: views[activeTab].loading,
    // The always-loaded upcoming view, so the page's featured card is stable
    // across tab switches.
    upcoming: views.upcoming,
    error,
  };
}
