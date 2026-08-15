import type { LandingEvent } from "@/shared/types";
import { formatEventDate, formatTime, eventStatusLabel, isEventLive } from "@/shared/lib/date-utils";

/** The hero tile's overlay: the next event, or a placeholder when the
 *  calendar is empty. Shared by the guest and attendee landings so the two
 *  cannot read different things from the same hero. */
export function FeaturedSessionCard({ event }: { event: LandingEvent | null }) {
  return (
    <div className="relative w-full rounded-2xl border border-white/25 bg-slate-950/30 p-4 text-white backdrop-blur-md">
      <div className="flex items-center justify-between text-xs font-medium text-white/80">
        <span>{event?.title ?? "No upcoming events"}</span>
        <span>
          {event
            ? isEventLive(event.event_date, event.start_time, event.end_time)
              ? "Live"
              : eventStatusLabel(event.status)
            : "Check back soon"}
        </span>
      </div>
      {event && (
        <div className="mt-3 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-surface text-brand">
            <span aria-hidden className="material-symbols-rounded ml-0.5 text-base">
              play_arrow
            </span>
          </span>
          <span className="text-sm font-semibold">
            {formatEventDate(event.event_date)} at {formatTime(event.start_time)}
          </span>
        </div>
      )}
    </div>
  );
}
