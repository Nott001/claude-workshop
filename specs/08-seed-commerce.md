# 08. Seed — commerce (PAYMENT and TICKET)

## Goal

Extend `supabase/seed.sql` with a small commerce surface so registration,
purchasing, and the tickets page work in the local sandbox: a paid ticket on the
active event for one attendee, and a pending payment to exercise the checkout
flow.

## Run order

After `07` (same seed file; needs the active event + attendee users).

## Files touched

- `supabase/seed.sql`

## Prerequisites

- Sheet `07` complete; fixed IDs for `EVENT` and attendee `USER` are determinable.

## Steps

1. Insert one `PAYMENT` for the active event by the first attendee, with
   `status = 'paid'`, `paid_at` set, `amount`/`currency` matching the event,
   and `gateway_reference_id` set (the app requires it for webhook mapping).
2. Insert the matching `TICKET`:
   - `payment_id` → that payment
   - `user_id` / `event_id` → attendee + active event
   - `qr_token` unique (either a fixed string or `generate` — see note)
   - `status = 'issued'`
3. Insert a second `PAYMENT` by the other attendee with `status = 'pending'`
   (no ticket). This exercises the resume-pending + checkout path.
4. Guard with the sheet-06 idempotence convention. Use `ON CONFLICT DO NOTHING`
   on `TICKET.qr_token` (UNIQUE) and on `PAYMENT.gateway_reference_id` (UNIQUE).

## Verification

- `pnpm db:reset` succeeds.
- One attendee has `TICKET.status = 'issued'` on the active event and its linked
  `PAYMENT` is `paid`; the other attendee has exactly one `PAYMENT` in
  `pending` with **no** ticket.
- `SELECT customer…` — verify the join: attendee → payment → ticket is 1:1:1 for
  the paid row, and the pending row has no ticket.

## Risks / notes

- Check the actual schema in `00001` for `PAYMENT`/`TICKET` FKs (e.g. whether a
  ticket without a payment is semantically meaningful to the app) before
  inserting.
- `qr_token` is UNIQUE and the app's `fulfillment` regenerates it on issue; a
  fixed dev token in the seed is fine but must not collide with a real checkout.
- Do not seed refunded/failed states unless a later sheet needs them — keep the
  commerce surface minimal for now.
