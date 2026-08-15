import { formatVenue } from "@/shared/lib/event-format";

export interface VenueText {
  name?: string | null;
  address?: string | null;
}

/**
 * The Google Maps search URL for a venue, or null when the venue is empty.
 * A seam: call sites depend only on this string, so swapping to an embedded
 * map later changes nothing but this file.
 */
export function buildGoogleMapsUrl(venue: VenueText): string | null {
  const query = formatVenue(venue.name, venue.address);
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * The same venue as an embeddable map, for an iframe, or null when empty.
 *
 * `output=embed` rather than the Embed API: that one needs a key, and a key
 * shipped to the browser is a public key needing a billing account behind it
 * and referrer restrictions in front of it. This endpoint is undocumented and
 * Google could retire it, which is survivable here — the card keeps the plain
 * link underneath, so a broken frame costs the preview and not the address.
 *
 * There are no coordinates on an event, only venue text, so the map resolves
 * the query the same way the search URL above does.
 */
export function buildGoogleMapsEmbedUrl(venue: VenueText): string | null {
  const query = formatVenue(venue.name, venue.address);
  if (!query) return null;
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}
