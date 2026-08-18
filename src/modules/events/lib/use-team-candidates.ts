"use client";

import { useEffect, useState } from "react";
import type { AssignmentRow } from "@/modules/events/lib/types";

interface Candidates {
  rows: AssignmentRow[];
  /** The roster could not be loaded; the picker says so rather than reading empty. */
  error: boolean;
}

interface FacilitatorPayload {
  id: number;
  full_name: string;
  email: string;
}

interface SpeakerPayload {
  id: number;
  user_id: number;
  designation: string | null;
  USER: { full_name: string; email: string } | null;
}

/**
 * Both rosters were fetched twice on the staff event page: once by the embedded
 * edit form and once by the assignment tables beside it. Owning the request in
 * one hook per roster means whichever surface is on screen pays for it once and
 * the other surface does not exist.
 */
function useCandidates<T>(url: string, toRows: (payload: T) => AssignmentRow[]): Candidates {
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((payload: T) => {
        if (!cancelled) setRows(toRows(payload));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
    // `toRows` is a module-level function per call site, so it is stable; the
    // url is the only thing that can actually change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return { rows, error };
}

const facilitatorRows = (payload: FacilitatorPayload[]): AssignmentRow[] =>
  (Array.isArray(payload) ? payload : []).map((f) => ({ id: f.id, name: f.full_name, detail: f.email }));

const speakerRows = (payload: { data?: SpeakerPayload[] }): AssignmentRow[] =>
  (payload?.data ?? []).map((s) => ({
    id: s.id,
    name: s.USER?.full_name ?? `User #${s.user_id}`,
    detail: s.designation ?? s.USER?.email ?? undefined,
  }));

export function useFacilitatorCandidates(): Candidates {
  return useCandidates("/api/facilitators", facilitatorRows);
}

export function useSpeakerCandidates(): Candidates {
  return useCandidates("/api/speakers?role=speaker&limit=100", speakerRows);
}
