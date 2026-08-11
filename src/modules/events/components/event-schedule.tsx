"use client";

import { useEffect, useState } from "react";
import { formatTime } from "@/shared/lib/date-utils";
import type { EventScheduleItem, EventWithCourse } from "@/modules/events/lib/types";

function moduleWindow(item: EventScheduleItem): string | null {
  if (item.start_time && item.end_time) return `${formatTime(item.start_time)} – ${formatTime(item.end_time)}`;
  if (item.start_time) return formatTime(item.start_time);
  return null;
}

function TimelineEntry({ time, title, last }: { time: string; title: string; last?: boolean }) {
  return (
    <li className="grid grid-cols-[1fr_auto] gap-x-6">
      <div className={`relative border-l-2 pl-6 ${last ? "border-transparent" : "border-border pb-5"}`}>
        <span className="absolute -left-[9px] top-0 size-4 rounded-full border-4 border-surface bg-brand" />
        <span className="text-sm font-bold">{title}</span>
      </div>
      <span className="pt-px text-right text-xs font-bold text-brand">{time}</span>
    </li>
  );
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
      <h2 className="text-lg font-bold">Event schedule</h2>
      {loading ? (
        <p className="mt-4 text-sm text-muted-fg">Loading schedule…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-error">Couldn&apos;t load the schedule.</p>
      ) : (
        <ol className="mt-5">
          <TimelineEntry time={formatTime(event.start_time)} title="Event starts" />
          {modules && modules.length === 0 ? (
            <li className="grid grid-cols-[1fr_auto] gap-x-6">
              <div className="border-l-2 border-border pb-5 pl-6">
                <p className="text-sm text-muted-fg">No schedule yet.</p>
              </div>
              <span />
            </li>
          ) : (
            (modules ?? []).map((item) => {
              const window = moduleWindow(item);
              return (
                <li key={item.id} className="grid grid-cols-[1fr_auto] gap-x-6">
                  <div className="relative border-l-2 border-border pb-6 pl-6">
                    <span className="absolute -left-[9px] top-0 size-4 rounded-full border-4 border-surface bg-brand" />
                    <span className="block text-sm font-semibold">{item.module_name}</span>
                    {item.speaker && (
                      <span className="mt-0.5 block text-xs font-normal text-muted-fg">Speaker: {item.speaker}</span>
                    )}
                  </div>
                  <span className="pt-px text-right text-xs font-bold text-brand">{window ?? ""}</span>
                </li>
              );
            })
          )}
          <TimelineEntry time={formatTime(event.end_time)} title="Event ends" last />
        </ol>
      )}
    </div>
  );
}
