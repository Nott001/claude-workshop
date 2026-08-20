"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CommunityLink } from "@/shared/types";

/**
 * The card list for both community pages. The API is role-aware: an admin gets
 * every card (hidden included), everyone else the visible ones, so one hook
 * serves the public page and the staff management page alike.
 */
export function useCommunityLinks(initial?: CommunityLink[]) {
  const [links, setLinks] = useState<CommunityLink[]>(initial ?? []);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState(false);
  // Held, not counted down: in development React mounts twice, so a flag spent
  // by the discarded pass leaves the real one refetching the rows the server
  // already sent. This hook only ever issues one query, so while a seed is in
  // hand there is nothing for the effect to ask. `reload` is unaffected — the
  // staff page still calls it after an edit and gets a fresh read.
  const seededRef = useRef(!!initial);

  const reload = useCallback(async () => {
    // An explicit reload supersedes the seed for good.
    seededRef.current = false;
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
    if (seededRef.current) return;
    void reload();
  }, [reload]);

  return { links, loading, error, reload };
}
