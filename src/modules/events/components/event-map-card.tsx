"use client";

import { useState } from "react";
import { buildGoogleMapsEmbedUrl } from "@/shared/lib/google-maps";
import { formatVenue } from "@/shared/lib/event-format";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/dialog";
import type { EventMode } from "@/shared/types";

interface EventMapCardProps {
  event: {
    venue_name: string | null | undefined;
    venue_address: string | null | undefined;
    event_type?: EventMode | null;
  };
}

const BUTTON_STYLES =
  "inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium whitespace-nowrap text-fg transition-colors outline-none select-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50";

export function EventMapCard({ event }: EventMapCardProps) {
  const [open, setOpen] = useState(false);

  const embedUrl = buildGoogleMapsEmbedUrl({ name: event.venue_name, address: event.venue_address });

  // Branching on the mode rather than on empty text, because the text is never
  // empty: an online event's venue_name holds its platform, and mapping "Zoom"
  // would render a confident map of an office in California.
  if (event.event_type === "online" || !embedUrl) return null;

  const venue = formatVenue(event.venue_name, event.venue_address);

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-[0_4px_20px_rgba(0,0,0,.05)]">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
        <span aria-hidden className="material-symbols-rounded text-base text-brand">
          location_on
        </span>
        Address
      </h2>
      <p className="mt-2 text-sm text-muted-fg">{venue}</p>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 block w-full overflow-hidden rounded-lg border border-border outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {/* Inert on purpose. A live frame here would hand its own clicks to
            Google and navigate off the site, and it would sit in the tab order
            inside a button. The address above already names the place, so the
            preview carries nothing a screen reader needs. */}
        <iframe
          aria-hidden
          tabIndex={-1}
          src={embedUrl}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="pointer-events-none block h-40 w-full"
        />
        <span className="sr-only">Open a larger map of {venue}</span>
      </button>

      <button type="button" onClick={() => setOpen(true)} className={`mt-4 ${BUTTON_STYLES}`}>
        <span aria-hidden className="material-symbols-rounded">
          map
        </span>
        View larger map
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-base leading-6 font-bold text-fg">{venue}</DialogTitle>
          </DialogHeader>
          {/* The one that is meant to be used: pannable, zoomable, and titled,
              since this is the frame a screen reader should reach. */}
          <iframe
            title={`Map of ${venue}`}
            src={embedUrl}
            referrerPolicy="no-referrer-when-downgrade"
            className="mt-4 h-[60vh] w-full rounded-lg border border-border"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
