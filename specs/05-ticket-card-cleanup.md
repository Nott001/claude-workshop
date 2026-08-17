# 05 — Ticket card: drop extra metadata, show the code under the QR

## Goal

On the user's `/tickets` page, remove **Payment #**, **Issued date**, and **Paid date** from the ticket card, and display the short code beneath the QR so the attendee can read it off their own screen (phone or laptop) if they cannot scan.

## Why

Issue #240: those three values are internal bookkeeping, not anything a gate checks; they clutter the ticket. The code, by contrast, is the point of this whole change — it must be visible where the attendee can actually type it. Removing the footer also lets the ticket list stop embedding `PAYMENT`, one less join per row.

Do **not** touch the staff payments table (`src/app/payments/page.tsx` shows `Paid At` for staff and is out of scope).

## Prerequisites

- Sheets 01–04 applied.

## Changes

### `src/shared/db/dao/ticket.dao.ts`

1. Rename `TicketWithPaymentAndEvent` → `TicketWithEvent` and drop the `PAYMENT` field:
   ```ts
   export interface TicketWithEvent extends Ticket {
     EVENT: TicketEvent | null;
   }
   ```
2. `TICKET_CARD_SELECT` loses its payment half:
   ```ts
   const TICKET_CARD_SELECT = "*, EVENT(title, event_date, start_time, end_time, venue_name, venue_address, price, currency)";
   ```
   (No new embed is added, so the AGENTS.md PostgREST-grants caveat does not apply — this removes a join, not adds one. Every ticket path here reads via `getServiceClient()`.)
3. Update the return types of `listByUser`, `listAll` (and their docs) to `PaginatedResult<TicketWithEvent>` and `findWithPaymentAndEvent` → `findWithEvent`, returning `TicketWithEvent | null`.

### `src/modules/commerce/lib/use-tickets.ts`

Import and re-export the renamed type:

```ts
import type { TicketWithEvent } from "@/shared/db/dao/ticket.dao";
export type Ticket = TicketWithEvent;
```

### `src/app/api/tickets/[paymentId]/route.ts`

Call the renamed DAO: `ticketDao.findWithEvent(...)`. The `generateQRDataUrl` call and response shape are unchanged.

### `src/modules/commerce/components/ticket-card.tsx`

1. Delete `const payment = ticket.PAYMENT;` and the `paidTime` computation (the null-guard on `payment?.paid_at` no longer applies since `PAYMENT` is gone).
2. Delete the footer block rendering `Payment #`, `Issued`, `Paid`.
3. Render the code under the QR. The right column currently only holds the QR image/placeholder; wrap both in a column flex and add a labelled code underneath (in all three QR states so the code never disappears when the image fails):
   ```tsx
   <div className="flex w-56 shrink-0 flex-col items-center justify-center gap-3 border-l border-dashed border-border bg-muted p-6">
     {qrFailed ? ( … existing "No QR" … ) : qrSvg ? ( … existing QR … ) : ( … existing spinner … )}
     <div className="text-center">
       <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Check-in code</span>
       <span className="font-mono text-base font-bold tracking-widest text-fg">{ticket.qr_token}</span>
     </div>
   </div>
   ```

## Tests

- `test/log-and-ticket-shapes.test.tsx` — the `Ticket` fixture loses `PAYMENT`. Assert the card no longer renders the removed fields and now shows the code:
  ```tsx
  it("shows the check-in code and hides payment bookkeeping", () => {
    render(<TicketCard ticket={ticket} />);
    expect(screen.getByText("tok")).toBeTruthy();
    expect(screen.queryByText(/Payment #/)).toBeNull();
    expect(screen.queryByText(/Issued/)).toBeNull();
    expect(screen.queryByText(/Paid/)).toBeNull();
  });
  ```
- `test/ticket-list-payload.test.ts` — the row fixture no longer carries `PAYMENT`. Rewrite the two "payment embed" tests to assert the select **excludes** `PAYMENT(` while still including `EVENT(title` and `qr_token` (the list query must still carry everything the card renders — the regression these tests guard).
- `test/api-role-scoping.test.ts` — rename the mocked `findWithPaymentAndEvent` to `findWithEvent` in the hoist, the mock factory, and both `mockResolvedValue` sites.

## Verification gates

```
pnpm test -- test/log-and-ticket-shapes.test.tsx test/ticket-list-payload.test.ts test/api-role-scoping.test.ts
pnpm typecheck
pnpm lint
pnpm format
```
