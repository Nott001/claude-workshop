"use client";

import { useState, type ReactNode } from "react";
import { CountdownTimer } from "@/modules/events/components/countdown-timer";
import { EventStatusBadge } from "@/modules/events/components/event-status-badge";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/shared/components/dialog";
import { formatEventDate, formatTime } from "@/shared/lib/date-utils";
import { eventModeIcon, formatDuration, formatVenue } from "@/shared/lib/event-format";
import type { EventWithCourse } from "@/modules/events/lib/types";

interface EventDetailHeroProps {
  event: Pick<
    EventWithCourse,
    | "title"
    | "event_date"
    | "start_time"
    | "end_time"
    | "cover_image_url"
    | "venue_name"
    | "venue_address"
    | "status"
    | "event_type"
  >;
}

function FactRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="material-symbols-rounded mt-0.5 text-base text-brand">{icon}</span>
      <div>
        <dt className="text-xs text-muted-fg">{label}</dt>
        <dd className="font-semibold">{value}</dd>
      </div>
    </div>
  );
}

/**
 * The hero's picture, and the overlay it opens.
 *
 * Only a real cover opens: with none, the panel is a gradient standing in for
 * a picture, and enlarging it would show the reader nothing they cannot
 * already see — so it stays inert, cursor and all.
 *
 * The affordance is the cursor and nothing else. No lift, no zoom, no dimming:
 * the panel is the largest thing on the page, and anything that moves or
 * recolours under the pointer at that size reads as the page glitching rather
 * than as an invitation.
 */
function CoverPanel({ title, coverImageUrl, badge }: { title: string; coverImageUrl: string | null; badge: ReactNode }) {
  const [open, setOpen] = useState(false);

  const layers = (
    <>
      <div className="absolute inset-0 bg-gradient-to-br from-sky-500 via-cyan-400 to-teal-300" />
      {coverImageUrl && <img src={coverImageUrl} alt={title} className="absolute inset-0 size-full object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      {!coverImageUrl && (
        <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_20%,rgba(255,255,255,.2)_20%,transparent_21%)] [background-size:28px_28px] opacity-50" />
      )}
    </>
  );

  return (
    // Only the two-column layout gets the taller panel. Stacked on a phone
    // this column is pure decoration sitting above the facts, and 400px of it
    // would push the title below the fold.
    <div className="relative min-h-[320px] lg:min-h-[400px]">
      {coverImageUrl ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          // A button, not a div with a handler, so the cover opens from the
          // keyboard too — the cursor is only half the affordance.
          className="absolute inset-0 cursor-pointer"
          aria-label={`View the cover image for ${title}`}
        >
          {layers}
        </button>
      ) : (
        layers
      )}

      {/* Transparent to the pointer so the badge does not cut a dead patch out
          of the corner of a panel that is otherwise clickable end to end. */}
      <div className="pointer-events-none absolute top-4 left-4">{badge}</div>

      {coverImageUrl && (
        <Dialog open={open} onOpenChange={setOpen}>
          {/* The shared close button is skipped for one of our own: that one
              is a ghost control drawn in the foreground colour, which over a
              dark cover is invisible. This one carries its own dark disc and
              white glyph, so it reads against whatever was uploaded. */}
          <DialogContent
            showCloseButton={false}
            className="w-auto max-w-[calc(100%-2rem)] bg-transparent p-0 shadow-none sm:max-w-4xl"
          >
            {/* The picture is the whole overlay, so its name is carried for
                assistive tech rather than drawn over the image. */}
            <DialogTitle className="sr-only">{title}</DialogTitle>
            <DialogClose
              aria-label="Close"
              className="absolute top-2 right-2 z-10 flex size-9 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm"
            >
              <span aria-hidden className="material-symbols-rounded text-[20px]">
                close
              </span>
            </DialogClose>
            {/* next/image is no help inside a modal: the source is a storage
                URL it cannot fetch without remotePatterns, and an overlay is
                never the page's LCP element. The hero's own img keeps the
                warning, because that one can be. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverImageUrl} alt={title} className="max-h-[85vh] w-full rounded-xl object-contain" />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export function EventDetailHero({ event }: EventDetailHeroProps) {
  const duration = formatDuration(event.start_time, event.end_time);
  const online = event.event_type === "online";
  // An online event has no address to fold in, and its venue_name is the
  // platform. formatVenue would still be correct, but going through it implies
  // there is an address that simply happens to be missing.
  const venue = online ? (event.venue_name?.trim() ?? "") : formatVenue(event.venue_name, event.venue_address);

  const facts: { icon: string; label: string; value: string }[] = [
    { icon: "calendar_today", label: "Date", value: formatEventDate(event.event_date) },
    { icon: "schedule", label: "Time", value: `${formatTime(event.start_time)} – ${formatTime(event.end_time)}` },
  ];
  if (duration) facts.push({ icon: "hourglass_empty", label: "Duration", value: duration });
  // The fact that used to be the only hint an event was online, back when the
  // hint had to be smuggled into the venue text a human wrote.
  if (venue) facts.push({ icon: eventModeIcon(event.event_type), label: online ? "Online" : "Venue", value: venue });

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[0_4px_20px_rgba(0,0,0,.05)]">
      {/* fr, not %: with percentages the 24px gap pushed the text column past
          the card, where overflow-hidden clipped it — costing this panel most
          of its right padding and leaving the title against the edge. */}
      <div className="grid gap-6 lg:grid-cols-[65fr_35fr]">
        <CoverPanel
          title={event.title}
          coverImageUrl={event.cover_image_url}
          badge={
            <EventStatusBadge
              status={event.status}
              date={event.event_date}
              startTime={event.start_time}
              endTime={event.end_time}
            />
          }
        />

        <div className="flex flex-col justify-center p-6 sm:p-7 lg:pl-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">{event.title}</h1>
          <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {facts.map((fact) => (
              <FactRow key={fact.label} {...fact} />
            ))}
          </dl>

          <CountdownTimer eventDate={event.event_date} startTime={event.start_time} label="Starts in" />
        </div>
      </div>
    </div>
  );
}
