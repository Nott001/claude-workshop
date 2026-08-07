"use client";

import { buildTimeline } from "@/modules/events/lib/session-timeline";
import type { LiveModuleSource } from "@/modules/events/lib/live-module";
import { formatTime } from "@/shared/lib/date-utils";

interface SessionTimelineProps {
  modules: LiveModuleSource[];
  eventDate: string;
  assignedSpeakerCount: number;
  now?: Date;
}

/**
 * The room's side roadmap: every scheduled module in the order it runs,
 * marked done, live or up next. Speaker names follow the same rule as the
 * room cards — only shown when the event has more than one assigned speaker.
 */
export function SessionTimeline({ modules, eventDate, assignedSpeakerCount, now = new Date() }: SessionTimelineProps) {
  const timeline = buildTimeline(modules, eventDate, now);
  if (timeline.length === 0) return null;

  return (
    <div className="flex flex-col">
      <h2 className="mb-4 text-xs font-bold uppercase tracking-[1px] text-muted-fg">Agenda</h2>
      <ol className="flex flex-col">
        {timeline.map(({ module, status }, index) => {
          const isLast = index === timeline.length - 1;
          const speaker = module.SPEAKER_PROFILE?.USER?.full_name ?? null;
          const passed = status === "completed" || status === "live";
          return (
            <li key={module.id} className="relative flex gap-3 pb-6 last:pb-0">
              {!isLast && (
                <span
                  className={`absolute left-[7px] top-5 h-full w-px ${passed ? "bg-brand" : "bg-border"}`}
                  aria-hidden="true"
                />
              )}
              <span className="relative z-10 mt-1 grid size-4 shrink-0 place-items-center rounded-full bg-bg">
                {status === "completed" ? (
                  <span className="grid size-4 place-items-center rounded-full bg-brand text-white">
                    <span className="material-symbols-rounded text-[12px]">check</span>
                  </span>
                ) : status === "live" ? (
                  <span className="grid size-4 place-items-center rounded-full border-2 border-brand">
                    <span className="size-2 animate-pulse rounded-full bg-brand" />
                  </span>
                ) : (
                  <span className="size-3 rounded-full border border-muted-fg/40" />
                )}
              </span>
              <div className={passed ? "" : "opacity-60"}>
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${status === "live" ? "font-bold text-fg" : "font-medium text-fg"}`}>
                    {module.module_name}
                  </span>
                  {status === "live" && <span className="text-[10px] font-bold uppercase tracking-wider text-brand">Live</span>}
                </div>
                <div className="mt-0.5 text-xs text-muted-fg">
                  {formatTime(module.start_time!)} – {formatTime(module.end_time!)}
                  {assignedSpeakerCount > 1 && speaker ? ` · ${speaker}` : ""}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
