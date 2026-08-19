"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/shared/lib/fetcher";
import type { ModuleChoice } from "@/shared/db/dao/course.dao";

interface ReleaseResponse {
  module_ids: number[];
  modules: ModuleChoice[];
}

/**
 * The staff editor's state for one event's after-event modules.
 *
 * The selection is held locally while it is being edited and only replaces the
 * server's on save, so ticking three modules is one write rather than three —
 * and a failed save leaves the choices on screen to retry instead of silently
 * reverting them.
 */
export function useAfterEventModules(eventId: string) {
  const key = `/api/events/${eventId}/after-event-modules`;
  const { data, error, isLoading, mutate } = useSWR<ReleaseResponse>(key, fetcher, { revalidateOnFocus: false });

  const [draft, setDraft] = useState<number[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const selected = draft ?? data?.module_ids ?? [];
  const dirty = draft !== null && data !== undefined && !sameSet(draft, data.module_ids);

  function toggle(moduleId: number) {
    setDraft(selected.includes(moduleId) ? selected.filter((id) => id !== moduleId) : [...selected, moduleId]);
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(key, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module_ids: selected }),
      });
      if (!res.ok) {
        setSaveError((await res.json().catch(() => null))?.error ?? "Could not save which modules are held back.");
        return;
      }
      await mutate();
      setDraft(null);
    } finally {
      setSaving(false);
    }
  }

  return {
    modules: data?.modules ?? [],
    selected,
    dirty,
    saving,
    loading: isLoading,
    error: error ? "Could not load this event's modules." : saveError,
    toggle,
    save,
  };
}

function sameSet(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}
