/**
 * Presentation for the EVENT columns that more than one surface renders.
 * Ticket cards and the event detail page have to agree on what "free" looks
 * like and on whether the address is part of the venue line.
 */
import type { EventMode } from "@/shared/types";

/**
 * The icon every surface uses to say where an event happens. Card, hero and
 * the mode picker in the form each had their own copy of this pair, so a card
 * kept claiming an online event was onsite. Anything that is not `online` —
 * including a row written before the column existed — reads as onsite, the
 * same default the database gives it.
 */
export function eventModeIcon(mode: EventMode | null | undefined): string {
  return mode === "online" ? "videocam" : "location_on";
}

/** `null` for a free event, so callers can omit the row rather than print "0". */
export function formatEventPrice(price: number | null | undefined, currency: string | null | undefined): string | null {
  if (!price || price <= 0) return null;
  return `${currency ?? "PHP"} ${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export function formatVenue(venueName: string | null | undefined, venueAddress: string | null | undefined): string {
  const name = venueName?.trim() ?? "";
  const address = venueAddress?.trim() ?? "";

  if (name && address) return `${name}, ${address}`;
  return name || address;
}

/** Seconds since midnight for an "HH:MM[:SS]" time, or null when unparseable. */
function parseTimeToSeconds(time: string | null | undefined): number | null {
  if (!time) return null;
  const [hours, minutes = "0", seconds = "0"] = time.split(":");
  const h = Number(hours);
  const m = Number(minutes);
  const s = Number(seconds);
  if (Number.isNaN(h) || Number.isNaN(m) || Number.isNaN(s)) return null;
  return h * 3600 + m * 60 + s;
}

/**
 * A human duration ("7 hours") for an event window, or null when the edges
 * are missing, unparseable or inverted. A sub-minute window is treated as
 * nonsense too, so the hero simply omits the duration line.
 */
export function formatDuration(startTime: string | null | undefined, endTime: string | null | undefined): string | null {
  const start = parseTimeToSeconds(startTime);
  const end = parseTimeToSeconds(endTime);
  if (start === null || end === null || end <= start) return null;

  const minutes = Math.floor((end - start) / 60);
  if (minutes < 1) return null;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  return `${hours} hr ${rest} min`;
}
