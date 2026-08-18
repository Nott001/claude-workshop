"use client";

import { CountdownTimer } from "@/modules/events/components/countdown-timer";
import { EventStatusBadge } from "@/modules/events/components/event-status-badge";
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
        {/* Only the two-column layout gets the taller panel. Stacked on a
            phone this column is pure decoration sitting above the facts, and
            400px of it would push the title below the fold. */}
        <div className="relative min-h-[320px] lg:min-h-[400px]">
          <div className="absolute inset-0 bg-gradient-to-br from-sky-500 via-cyan-400 to-teal-300" />
          {event.cover_image_url && (
            <img src={event.cover_image_url} alt={event.title} className="absolute inset-0 size-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          {!event.cover_image_url && (
            <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_20%,rgba(255,255,255,.2)_20%,transparent_21%)] [background-size:28px_28px] opacity-50" />
          )}
          <div className="absolute left-4 top-4">
            <EventStatusBadge
              status={event.status}
              date={event.event_date}
              startTime={event.start_time}
              endTime={event.end_time}
            />
          </div>
        </div>

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
