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
