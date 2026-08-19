"use client";

import Link from "next/link";

import { formatEventDate, formatTime, isEventLive } from "@/shared/lib/date-utils";
import { eventModeIcon } from "@/shared/lib/event-format";
import { EventStatusBadge } from "@/modules/events/components/event-status-badge";
import { CountdownTimer } from "@/modules/events/components/countdown-timer";
import type { LandingEvent } from "@/shared/types";

interface FeaturedEventCardProps {
  event: LandingEvent;
}

export function FeaturedEventCard({ event }: FeaturedEventCardProps) {
  const live = isEventLive(event.event_date, event.start_time, event.end_time);

  return (
    <Link
      href={`/speaker/events/${event.event_id}`}
      // One card is one prefetch, and a grid scrolls several into view at once
      // — each a full render of a detail page nobody has opened.
      prefetch={false}
      className="group block overflow-hidden rounded-xl border border-border bg-surface shadow-[0_4px_20px_rgba(0,0,0,.05)] transition-all duration-300 ease-in-out hover:scale-[1.02] hover:shadow-[0_8px_30px_rgba(0,0,0,.12)]"
    >
      <article>
        <div className="relative h-48 overflow-hidden p-6 text-white">
          <div className="absolute inset-0 bg-gradient-to-br from-sky-500 via-cyan-400 to-teal-300 transition-transform duration-300 ease-in-out group-hover:scale-105" />
          {event.cover_image_url && (
            // Mirrors EventCard's cover handling; next/image would need sizing
            // props this card's banner never pins down.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.cover_image_url}
              alt={event.title}
              className="absolute inset-0 size-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <EventStatusBadge
            status={event.status}
            date={event.event_date}
            startTime={event.start_time}
            endTime={event.end_time}
          />
          <div className="absolute inset-x-0 bottom-0 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/80">{live ? "Happening now" : "Up next"}</p>
            <h3 className="mt-1 text-2xl font-semibold tracking-[-0.02em]">{event.title}</h3>
          </div>
        </div>
        <div className="p-6">
          <div className="flex items-start justify-between gap-6">
            <div className="space-y-2 text-sm text-muted-fg">
              <p className="flex items-center gap-2">
                <span className="material-symbols-rounded text-base text-brand">calendar_today</span>{" "}
                {formatEventDate(event.event_date)}
              </p>
              <p className="flex items-center gap-2">
                <span className="material-symbols-rounded text-base text-brand">schedule</span> {formatTime(event.start_time)} –{" "}
                {formatTime(event.end_time)}
              </p>
              <p className="flex items-center gap-2">
                {/* The mode is carried by the icon alone, which a screen reader
                    would otherwise read out as the ligature text "videocam". */}
                <span aria-hidden className="material-symbols-rounded text-base text-brand">
                  {eventModeIcon(event.event_type)}
                </span>
                <span className="sr-only">{event.event_type === "online" ? "Online:" : "Venue:"}</span>
                <span>{event.venue_name}</span>
              </p>
            </div>
            {!live && <CountdownTimer eventDate={event.event_date} startTime={event.start_time} label="Starts in" />}
          </div>
        </div>
      </article>
    </Link>
  );
}
