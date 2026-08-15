"use client";

import { buildGoogleMapsUrl } from "@/shared/lib/google-maps";

interface EventMapCardProps {
  event: { venue_name: string | null | undefined; venue_address: string | null | undefined };
}

const LINK_STYLES =
  "inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium whitespace-nowrap text-fg transition-colors outline-none select-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50";

export function EventMapCard({ event }: EventMapCardProps) {
  const url = buildGoogleMapsUrl({ name: event.venue_name, address: event.venue_address });
  if (!url) return null;

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-[0_4px_20px_rgba(0,0,0,.05)]">
      {/* A real <a>: the Base UI Button forces button semantics on its render
          target, so a link would be mislabelled to screen readers. */}
      <a href={url} target="_blank" rel="noopener" className={LINK_STYLES}>
        <span className="material-symbols-rounded">map</span>
        View in Google Maps
      </a>
    </div>
  );
}
