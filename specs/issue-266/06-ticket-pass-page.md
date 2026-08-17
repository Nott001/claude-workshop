# 06 — Mobile boarding-pass ticket page with live status

## Goal

Add `/tickets/[ticketId]` — a mobile-first, boarding-pass-style view of a single ticket: event title band, date/time/venue, a **large QR** plus the typeable check-in code, a status banner, and a "present at the entrance" hint. The status flips **live** (Registered → Checked in with the time → Cancelled) as the kiosk admits the holder. The ticket list card links to it.

## Why

The attendee is the second realtime consumer from sheet 01. At the door they hold their phone up — the pass page must (a) be legible and scannable on a phone, and (b) reflect the check-in the moment it happens, which is exactly what the ticket-holder branch of `ticket_visible` exists for. Today a ticket only renders as a card in the `My Tickets` list; there is no full-screen view and no live status anywhere attendee-facing.

## Prerequisites

- Sheet 01 (holder RLS branch) and sheet 05 (detail endpoint) applied.

## Changes

### `src/shared/integrations/realtime/index.ts`

Add a per-ticket subscription, filtered on the primary key so it needs no replica identity:

```ts
export function subscribeToTicket(ticketId: number, onTicket: TicketCallback): RealtimeChannel {
  const channelName = `ticket-${ticketId}-${++counter}`;
  const sub = getBrowserClient()
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "TICKET",
        filter: `id=eq.${ticketId}`,
      },
      (payload) => {
        const ticket = payload.new as Ticket;
        if (ticket.status === "checked_in" || ticket.status === "cancelled") {
          onTicket(ticket);
        }
      },
    )
    .subscribe();

  return sub;
}
```

The check-in `UPDATE` carries `status` and `updated_at` in `payload.new`; the app already treats `updated_at` as the check-in time (`src/modules/events/lib/event-attendees.ts:43`), so the pass derives the time from `updated_at` and never relies on the nullable `checked_in_at` column.

### `src/modules/commerce/components/ticket-pass.tsx` (new)

Presentational, `"use client"`, single-purpose. Props: `{ ticket: TicketWithEvent }`. Renders:

- a status banner derived from `ticket.status` (Registered / Checked in + `formatTime(ticket.updated_at)` / Cancelled);
- the event title band, date/time and venue rows (reuse `formatEventDate`, `formatTime`, `formatVenue`, `formatEventPrice` from `@/shared/lib/date-utils` and `@/shared/lib/event-format`);
- a **large** QR rendered client-side with `renderQrSvg` from `@/shared/integrations/qr/svg` (same approach as `ticket-card.tsx`, sized for a phone — the QR area should dominate the fold, not sit in a side column);
- the check-in code under the QR (the typeable fallback, same label styling as `ticket-card.tsx`);
- a "Present at the entrance" hint and a back link to `/tickets`.

Keep the mobile layout single-column and viewport-safe (safe padding, `100dvh`-friendly scrolling — mirror the kiosk's dvh note).

### `src/app/tickets/[ticketId]/page.tsx` (new, client)

- Read `params.ticketId`, fetch `/api/tickets/detail/${ticketId}`.
- `404`/failure → "Ticket not found or unavailable" state (mirror the kiosk page's handling).
- Keep the loaded `TicketWithEvent` in state; on `checked_in`/`cancelled` realtime events merge `status` and `updated_at` into state via `subscribeToTicket`, and `unsubscribe` on unmount.
- Render `<TicketPass ticket={ticket} />`.

### `src/modules/commerce/components/ticket-card.tsx`

Add the entry point to the pass:

- wrap the QR/code column in a `<Link href={`/tickets/${ticket.id}`} prefetch={false}>` (valid HTML — that column is a sibling of the actions row, not nested inside the "Go to event" link; `prefetch={false}` matches the cold-isolate note already on the "Go to event" link), and
- add a secondary "View pass" link button in the actions row to the same destination.

## Tests

### New `test/realtime-ticket.test.ts`

Mirror `test/qa-realtime.test.ts`:

- subscribes with `event: "UPDATE"`, `table: "TICKET"`, `filter: "id=eq.<ticketId>"`;
- channel name starts with `ticket-<ticketId>`;
- fires the callback only for `checked_in` or `cancelled` new statuses (ignores `issued`, and any `UPDATE` carrying no status);
- tears down via the shared `unsubscribe`.

### New `test/ticket-pass.test.tsx`

Render `<TicketPass>` with a stubbed `TicketWithEvent`:

- shows the event title, the token, and the Registered badge;
- when `status: "checked_in"` shows Checked in plus the formatted `updated_at` time;
- when `status: "cancelled"` shows Cancelled.

Then a page-level test: mock `fetch` for `/api/tickets/detail/<id>` and mock `@/shared/integrations/realtime` with `subscribeToTicket` capturing the callback; assert the initial Registered state, invoke the captured callback with a `checked_in` payload carrying `updated_at`, and assert the banner flips to Checked in — this is the "flips live while being admitted" behavior, asserted through the real callback path, not a shape copy.

### Extend `test/kiosk-page.test.tsx` or `test/ticket-list-payload.test.ts`

Assert the list card links to `/tickets/<id>` (the entry point). Pick whichever file already renders `TicketCard`; add the link assertion there.

## Verification gates (run before committing this sheet)

```
pnpm test -- test/realtime-ticket.test.ts test/ticket-pass.test.tsx <list/test-file>
pnpm typecheck
pnpm lint
pnpm format
git diff --stat   # touches: realtime/index.ts, ticket-pass.tsx, tickets/[ticketId]/page.tsx, ticket-card.tsx, tests, this sheet
```

Commit as `feat: add a live boarding-pass ticket page`. Body: the attendee-facing half of the TICKET realtime read from sheet 01 — a mobile pass that flips to Checked in the moment the kiosk admits the holder.
