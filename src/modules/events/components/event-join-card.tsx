"use client";

import { meetingLinkState } from "@/modules/events/lib/meeting-link";
import type { EventWithCourse } from "@/modules/events/lib/types";

/**
 * Where an online event is joined from — the counterpart to the map card, which
 * renders nothing for an event that has no address.
 *
 * The link itself is only present when the API decided the reader may hold it,
 * so this component never has to work out who is looking. It renders what it
 * was given: a link when there is one, and the reason there is not otherwise.
 */
export function EventJoinCard({
  event,
}: {
  event: Pick<EventWithCourse, "event_type" | "event_date" | "start_time" | "meeting_url">;
}) {
  if (event.event_type !== "online") return null;

  const state = meetingLinkState(event);

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-[0_4px_20px_rgba(0,0,0,.05)]">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
        <span aria-hidden className="material-symbols-rounded text-base text-brand">
          videocam
        </span>
        Online event
      </h2>

      {state === "ready" && (
        <>
          <p className="mt-2 text-sm text-muted-fg">The room is open.</p>
          <a
            href={event.meeting_url ?? undefined}
            target="_blank"
            // noreferrer as well as noopener: the destination is a URL staff
            // typed, and the referrer would name the event page it came from.
            rel="noopener noreferrer"
            className="mt-4 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg shadow-sm transition-colors outline-none hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <span aria-hidden className="material-symbols-rounded text-base">
              open_in_new
            </span>
            Join the meeting
          </a>
        </>
      )}

      {/* "Not yet" and "never set" read identically on purpose: telling them
          apart would say whether a link exists to someone who may not have it. */}
      {state === "pending" && (
        <p className="mt-2 text-sm text-muted-fg">The joining link appears here when the event starts.</p>
      )}

      {state === "none" && (
        <p className="mt-2 text-sm text-muted-fg">
          No joining link has been posted yet. It will appear here as soon as the organisers add it.
        </p>
      )}
    </div>
  );
}
