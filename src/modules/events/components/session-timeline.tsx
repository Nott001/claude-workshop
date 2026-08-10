"use client";

import { buildTimeline } from "@/modules/events/lib/timeline";
import type { LiveModuleSource } from "@/shared/lib/live-module";
import { formatTime, parseLocalDateTime } from "@/shared/lib/date-utils";
import { ProgressBar } from "@/modules/events/components/progress-bar";

interface SessionTimelineProps {
  modules: LiveModuleSource[];
  eventDate: string;
  assignedSpeakerCount: number;
  eventStartTime?: string | null;
  eventEndTime?: string | null;
  now?: Date;
}

function overallProgress(
  eventDate: string,
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  now: Date,
): number {
  if (!startTime || !endTime) return 0;
  const start = parseLocalDateTime(eventDate, startTime);
  const end = parseLocalDateTime(eventDate, endTime);
  if (!start || !end || end.getTime() <= start.getTime()) return 0;
  const t = now.getTime();
  if (t < start.getTime()) return 0;
  if (t >= end.getTime()) return 1;
  return (t - start.getTime()) / (end.getTime() - start.getTime());
}

/**
 * The room's side roadmap: event start, every scheduled module in the order it
 * runs, event end — each marked done, live or up next. A vertical progress bar
 * fills continuously based on event time, so two events of different lengths
 * render the same bar — only the fill rate differs. Speaker names follow the
 * same rule as the room cards — only shown when the event has more than one
 * assigned speaker.
 */
export function SessionTimeline({
  modules,
  eventDate,
  assignedSpeakerCount,
  eventStartTime,
  eventEndTime,
  now = new Date(),
}: SessionTimelineProps) {
  const timeline = buildTimeline(modules, eventDate, eventStartTime, eventEndTime, now);
  if (timeline.length === 0) return null;

  const progress = overallProgress(eventDate, eventStartTime, eventEndTime, now);

  return (
    <div className="flex flex-col">
      <h2 className="mb-4 text-xs font-bold uppercase tracking-[1px] text-muted-fg">Agenda</h2>
      <div className="relative flex gap-3">
        <ProgressBar progress={progress} className="shrink-0" />
        <ol className="flex min-w-0 flex-1 flex-col">
          {timeline.map((item, index) => {
            const prevPosition = index === 0 ? 0 : timeline[index - 1].position;
            const gap = (item.position - prevPosition) * 180;

            if (item.kind === "bookend") {
              const passed = item.status === "completed";
              return (
                <li
                  key={`bookend-${item.label}`}
                  style={{ paddingTop: index === 0 ? 0 : gap }}
                  className="flex items-start gap-3 last:pb-0"
                >
                  <span className="relative z-10 mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-bg">
                    {passed ? (
                      <span className="grid size-4 place-items-center rounded-full bg-brand text-white">
                        <span className="material-symbols-rounded text-[12px]">flag</span>
                      </span>
                    ) : (
                      <span className="material-symbols-rounded size-4 text-muted-fg/40">flag</span>
                    )}
                  </span>
                  <div>
                    <span className="text-sm font-medium text-fg">{item.label}</span>
                    <div className="mt-0.5 text-xs text-muted-fg">{formatTime(item.time)}</div>
                  </div>
                </li>
              );
            }

            const speaker = item.module.SPEAKER_PROFILE?.USER?.full_name ?? null;
            const passed = item.status === "completed" || item.status === "live";
            return (
              <li
                key={item.module.id}
                style={{ paddingTop: index === 0 ? 0 : gap }}
                className="flex items-start gap-3 last:pb-0"
              >
                <span className="relative z-10 mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-bg">
                  {item.status === "completed" ? (
                    <span className="grid size-4 place-items-center rounded-full bg-brand text-white">
                      <span className="material-symbols-rounded text-[12px]">check</span>
                    </span>
                  ) : item.status === "live" ? (
                    <span className="grid size-4 place-items-center rounded-full border-2 border-brand">
                      <span className="size-2 animate-pulse rounded-full bg-brand" />
                    </span>
                  ) : (
                    <span className="size-3 rounded-full border border-muted-fg/40" />
                  )}
                </span>
                <div className={passed ? "" : "opacity-60"}>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${item.status === "live" ? "font-bold text-fg" : "font-medium text-fg"}`}>
                      {item.module.module_name}
                    </span>
                    {item.status === "live" && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand">Live</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-fg">
                    {formatTime(item.module.start_time!)} – {formatTime(item.module.end_time!)}
                    {assignedSpeakerCount > 1 && speaker ? ` · ${speaker}` : ""}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
