/**
 * The seat arithmetic for a capped event.
 *
 * Shared rather than kept in the events module because two modules ask the same
 * question about the same column: the events module gates registration, and
 * commerce refuses to open a checkout for a seat that no longer exists. Neither
 * module may import the other, and the rule must not be spelled twice.
 *
 * `capacity` is nullable in the database and null means uncapped, so every
 * answer here is nullable too — a caller that gets null has nothing to render
 * and nothing to refuse.
 */

/** Seats still available, floored at zero, or null when the event is uncapped. */
export function seatsLeft(capacity: number | null | undefined, attendeeCount: number): number | null {
  if (capacity == null) return null;
  return Math.max(0, capacity - attendeeCount);
}

/** Whether the last seat is gone. False for an uncapped event, always. */
export function isSoldOut(capacity: number | null | undefined, attendeeCount: number): boolean {
  return seatsLeft(capacity, attendeeCount) === 0;
}

/** The message every surface uses for a refused registration, so the API, the
 *  register page and the checkout all say the same thing the locked button on
 *  the event page does. */
export const SOLD_OUT_MESSAGE = "This event is sold out";
