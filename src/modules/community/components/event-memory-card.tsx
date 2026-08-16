import Link from "next/link";

import { formatEventDate } from "@/shared/lib/date-utils";
import { withBackLink } from "@/shared/lib/back-link";
import type { LandingEvent } from "@/shared/types";

/**
 * One finished event in the memories strip. Deliberately text-only — the app
 * holds a single cover image per event and no gallery behind it, so a photo
 * here would promise more than the archive can show.
 */
export function EventMemoryCard({ event }: { event: LandingEvent }) {
  return (
    <Link
      href={withBackLink(`/events/${event.event_id}`, "community")}
      // The memories strip is a grid of these, so it prefetches a detail render
      // per finished event the same way the upcoming grid did.
      prefetch={false}
      className="group flex h-full flex-col rounded-xl border border-border bg-surface p-5 transition-colors hover:border-brand"
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-fg">
        <span>{formatEventDate(event.event_date)}</span>
        {event.course_name && (
          <>
            <span aria-hidden>&middot;</span>
            <span className="truncate">{event.course_name}</span>
          </>
        )}
      </div>

      <h3 className="mt-2 text-base font-bold tracking-[-0.01em] text-fg">{event.title}</h3>

      <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-fg">
        <span aria-hidden className="material-symbols-rounded text-base!">
          location_on
        </span>
        <span className="truncate">{event.venue_name}</span>
      </p>

      <span className="mt-auto pt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand">
        View event
        <span aria-hidden className="material-symbols-rounded text-base!">
          chevron_right
        </span>
      </span>
    </Link>
  );
}
