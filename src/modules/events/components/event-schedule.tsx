"use client";

import { useEffect, useState } from "react";
import { formatTime } from "@/shared/lib/date-utils";
import type { EventScheduleItem } from "@/modules/events/lib/types";

export function EventSchedule({ eventId }: { eventId: string }) {
  const [modules, setModules] = useState<EventScheduleItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/events/${eventId}/schedule`);
        if (cancelled) return;
        if (!res.ok) {
          setModules(null);
          setError(true);
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setModules(data?.modules ?? []);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setModules(null);
        setError(true);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6 sm:p-7 shadow-[0_4px_20px_rgba(0,0,0,.05)]">
      <h2 className="text-lg font-bold">Course schedule</h2>
      {loading ? (
        <p className="mt-4 text-sm text-muted-fg">Loading schedule…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-error">Couldn&apos;t load the schedule.</p>
      ) : modules && modules.length === 0 ? (
        <p className="mt-4 text-sm text-muted-fg">No schedule yet.</p>
      ) : (
        <ol className="mt-5">
          {modules!.map((item) => {
            const start = item.start_time && item.end_time ? item.start_time : null;
            const toggleable = start && item.speaker != null;
            return (
              <li key={item.id} className="relative border-l-2 border-border pl-8 pb-6 last:border-transparent last:pb-0">
                <span className="absolute -left-[9px] top-0 size-4 rounded-full border-4 border-surface bg-brand" />
                {toggleable ? (
                  <button
                    type="button"
                    aria-expanded={expanded.has(item.id)}
                    onClick={() => toggle(item.id)}
                    className="flex w-full items-center gap-3 text-left"
                  >
                    <span className="w-16 shrink-0 text-xs font-bold text-brand">{formatTime(start!)}</span>
                    <span className="flex-1 text-sm font-semibold">{item.module_name}</span>
                    <span
                      className={`material-symbols-rounded text-xs text-muted-fg transition-transform ${expanded.has(item.id) ? "rotate-180" : ""}`}
                    >
                      expand_more
                    </span>
                  </button>
                ) : (
                  <div className="flex items-center gap-3 text-left">
                    {start && <span className="w-16 shrink-0 text-xs font-bold text-brand">{formatTime(start)}</span>}
                    <span className="flex-1 text-sm font-semibold">{item.module_name}</span>
                  </div>
                )}
                {toggleable && expanded.has(item.id) && (
                  <p className="mt-2 pl-[76px] text-sm text-muted-fg">Speaker: {item.speaker}</p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
