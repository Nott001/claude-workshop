"use client";

import { buildGoogleMapsEmbedUrl, buildGoogleMapsUrl } from "@/shared/lib/google-maps";
import { formatVenue } from "@/shared/lib/event-format";

interface EventMapCardProps {
  event: { venue_name: string | null | undefined; venue_address: string | null | undefined };
}

const LINK_STYLES =
  "inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium whitespace-nowrap text-fg transition-colors outline-none select-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50";

export function EventMapCard({ event }: EventMapCardProps) {
  const url = buildGoogleMapsUrl({ name: event.venue_name, address: event.venue_address });
  if (!url) return null;

  const venue = formatVenue(event.venue_name, event.venue_address);
  const embedUrl = buildGoogleMapsEmbedUrl({ name: event.venue_name, address: event.venue_address });

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-[0_4px_20px_rgba(0,0,0,.05)]">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
        <span aria-hidden className="material-symbols-rounded text-base text-brand">
          location_on
        </span>
        Address
      </h2>
      <p className="mt-2 text-sm text-muted-fg">{venue}</p>

      {embedUrl && (
        <iframe
          // Titled because a screen reader announces an iframe by its title
          // alone, and lazy because this is a third-party frame on a page that
          // is useful without it — the address above already says where to go.
          title={`Map of ${venue}`}
          src={embedUrl}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="mt-4 h-40 w-full rounded-lg border border-border"
        />
      )}

      {/* A real <a>: the Base UI Button forces button semantics on its render
          target, so a link would be mislabelled to screen readers. */}
      <a href={url} target="_blank" rel="noopener" className={`mt-4 ${LINK_STYLES}`}>
        <span aria-hidden className="material-symbols-rounded">
          map
        </span>
        View in Google Maps
      </a>
    </div>
  );
}
