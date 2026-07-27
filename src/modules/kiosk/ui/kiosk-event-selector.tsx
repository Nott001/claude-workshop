"use client";

import type { Event } from "@/types";
import { formatEventDate, formatTime } from "@/lib/date-utils";

interface Props {
  events: Event[];
  eventsLoading: boolean;
  error?: string | null;
  onSelect: (event: Event) => void;
}

export function KioskEventSelector({ events, eventsLoading, error, onSelect }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <span className="material-symbols-rounded mb-3 text-[48px] text-brand">qr_code_scanner</span>
          <h1 className="text-xl font-bold tracking-tight text-fg">Select Event</h1>
          <p className="mt-1 text-sm text-muted-fg">Choose an event to start scanning attendee QR codes.</p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">{error}</div>
        )}

        {eventsLoading ? (
          <div className="flex items-center justify-center py-12">
            <span className="material-symbols-rounded animate-spin text-3xl text-brand">progress_activity</span>
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-xl border border-border bg-muted px-6 py-12 text-center">
            <span className="material-symbols-rounded mb-2 text-3xl text-muted-fg">event_busy</span>
            <p className="text-sm font-medium text-fg">No upcoming events</p>
            <p className="mt-1 text-xs text-muted-fg">Create an event first, then return to the kiosk.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <button
                key={event.id}
                onClick={() => onSelect(event)}
                className="flex w-full items-center gap-4 rounded-xl border border-border bg-surface px-5 py-4 text-left transition hover:border-brand hover:shadow-sm"
              >
                <span className="material-symbols-rounded text-[28px] text-brand">event</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-fg">{event.title}</p>
                  <p className="mt-0.5 text-xs text-muted-fg">
                    {formatEventDate(event.event_date)} · {formatTime(event.start_time)} – {formatTime(event.end_time)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-fg">{event.venue_name}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                    event.status === "active" ? "bg-success/10 text-success" : "bg-muted-fg/10 text-muted-fg"
                  }`}
                >
                  {event.status}
                </span>
                <span className="material-symbols-rounded text-[18px] text-muted-fg">chevron_right</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
