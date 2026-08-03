/**
 * Presentation for the EVENT columns that more than one surface renders.
 * Ticket cards and the event detail page have to agree on what "free" looks
 * like and on whether the address is part of the venue line.
 */

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
