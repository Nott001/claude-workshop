"use client";

import { useCallback, useEffect, useState } from "react";
import type { CommunityLink } from "@/shared/types";

/**
 * The card list for both community pages. The API is role-aware: an admin gets
 * every card (hidden included), everyone else the visible ones, so one hook
 * serves the public page and the staff management page alike.
 */
export function useCommunityLinks() {
  const [links, setLinks] = useState<CommunityLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/community");
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = await res.json();
      setLinks(Array.isArray(data) ? data : []);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function load() {
      await reload();
    }
    void load();
  }, [reload]);

  return { links, loading, error, reload };
}
