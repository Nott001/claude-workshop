"use client";

import { useEffect, useState } from "react";
import { formatTime } from "@/shared/lib/date-utils";
import type { EventScheduleItem, EventWithCourse } from "@/modules/events/lib/types";

function moduleWindow(item: EventScheduleItem): string | null {
  if (item.start_time && item.end_time) return `${formatTime(item.start_time)} – ${formatTime(item.end_time)}`;
  if (item.start_time) return formatTime(item.start_time);
  return null;
}

export function EventSchedule({
  eventId,
  event,
}: {
  eventId: string;
  event: Pick<EventWithCourse, "event_date" | "start_time" | "end_time">;
}) {
  const [modules, setModules] = useState<EventScheduleItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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

  return (
    <div className="rounded-xl border border-border bg-surface p-6 sm:p-7 shadow-[0_4px_20px_rgba(0,0,0,.05)]">
      <h2 className="text-lg font-bold">Course schedule</h2>
      {loading ? (
        <p className="mt-4 text-sm text-muted-fg">Loading schedule…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-error">Couldn&apos;t load the schedule.</p>
      ) : (
        <ol className="mt-5">
          <li className="relative border-l-2 border-border pl-8 pb-5">
            <span className="absolute -left-[9px] top-0 size-4 rounded-full border-4 border-surface bg-brand" />
            <div className="flex items-baseline gap-3">
              <span className="w-32 shrink-0 text-xs font-bold text-brand">
                {formatTime(event.start_time)} – {formatTime(event.end_time)}
              </span>
              <span className="flex-1 text-sm font-bold">Event</span>
            </div>
          </li>
          {modules && modules.length === 0 ? (
            <p className="text-sm text-muted-fg">No schedule yet.</p>
          ) : (
            (modules ?? []).map((item) => {
              const window = moduleWindow(item);
              return (
                <li key={item.id} className="relative border-l-2 border-border pl-8 pb-6 last:border-transparent last:pb-0">
                  <span className="absolute -left-[9px] top-0 size-4 rounded-full border-4 border-surface bg-brand" />
                  <div className="flex items-start gap-3">
                    {window && <span className="w-32 shrink-0 pt-px text-xs font-bold text-brand">{window}</span>}
                    <span className="min-w-0 flex-1 text-sm font-semibold">
                      <span className="block">{item.module_name}</span>
                      {item.speaker && (
                        <span className="mt-0.5 block text-xs font-normal text-muted-fg">Speaker: {item.speaker}</span>
                      )}
                    </span>
                  </div>
                </li>
              );
            })
          )}
        </ol>
      )}
    </div>
  );
}
