import { formatVenue } from "@/shared/lib/event-format";

export interface VenueText {
  name?: string | null;
  address?: string | null;
}

/**
 * A venue as an embeddable map, for an iframe, or null when the venue is empty.
 *
 * The search URL that used to live here is gone with its last call site: the
 * address card shows the map in place now and never sends anyone to google.com,
 * so a link builder had nothing left to build for.
 *
 * `output=embed` rather than the Embed API: that one needs a key, and a key
 * shipped to the browser is a public key needing a billing account behind it
 * and referrer restrictions in front of it. This endpoint is undocumented, so
 * Google can retire it — and with the outbound link gone there is no longer a
 * fallback behind it. A retired endpoint leaves a blank frame under an address
 * that is still correct and still readable, which is the whole of the damage.
 *
 * There are no coordinates on an event, only venue text, so the map resolves
 * the venue as a search query.
 */
export function buildGoogleMapsEmbedUrl(venue: VenueText): string | null {
  const query = formatVenue(venue.name, venue.address);
  if (!query) return null;
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}
