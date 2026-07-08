# Build Phase 4 — Commerce: HitPay Checkout → Payment Webhook → Ticket/QR Issuance

## Context

Attendees must be able to purchase tickets for events. The payment flow is async: the attendee initiates a payment, is redirected to HitPay's hosted checkout page, and upon successful payment HitPay sends a webhook to the server. A ticket with a unique QR token is issued only after payment confirmation. This phase depends on Phase 3 (events must exist) and Phase 1 (auth).

## Objective

Build the commerce pipeline: PAYMENTS and TICKETS tables; payment initiation API; HitPay redirect; webhook handler for payment confirmation; QR token generation and ticket display; attendee ticket wallet and payment status pages; facilitator payment overview.

## Scope

- Database migrations: PAYMENTS, TICKETS tables (all fields, constraints, unique indexes, FKs, status enums per data-model.md)
- API routes:
  - `POST /api/payments` — initiate payment for an event (attendee); creates PAYMENT record, returns HitPay checkout URL
  - `GET /api/payments/[id]` — get payment status (attendee: own; facilitator: all)
  - `POST /api/payments/webhook` — HitPay webhook receiver; validates HMAC signature; updates PAYMENT status; inserts TICKET if `paid`; returns 200
  - `GET /api/tickets` — list own tickets (attendee); list all tickets (facilitator)
  - `GET /api/tickets/[paymentId]` — get ticket with QR data
  - `GET /api/events/[id]/register` — registration page data (attendee)
  - `POST /api/events/[id]/register` — express intent + validate no duplicate registration
- Screens:
  - `/events/[id]/register` — event registration page with terms agreement
  - `/checkout/[paymentId]` — redirects to HitPay; shows status while waiting
  - `/tickets` — attendee ticket wallet with QR display
  - `/payments` — payment status list (attendee: own; facilitator: all)
- `modules/commerce/` domain logic:
  - HMAC signature verification for webhooks
  - QR token generation (crypto-random, unique)
  - Payment status transition guards (`pending → paid | failed`, `paid → refunded` only)
  - Ticket status default `issued`
  - Business rule: one active (non-cancelled) ticket per user per event
  - Business rule: ticket issued only after PAYMENTS.status = `paid`
- `lib/hitpay/` — HitPay API client wrapper and signature helpers
- `lib/qr/` — QR generation utility (e.g., `qrcode` npm package)

## Constraints

- `hitpay_reference_id` must be unique; reject duplicate webhooks with idempotency
- QR token must be a cryptographically random string (min 32 chars) — never sequential or guessable
- Payment webhook endpoint MUST be publicly accessible (HitPay calls it), but MUST validate HMAC signature before processing
- No ticket creation on `pending` or `failed` webhook events
- Facilitator cannot create payments on behalf of attendees

## Deliverable

- Attendee can register for an event, complete HitPay checkout, and see their ticket with QR
- Payment webhook correctly issues ticket only on `paid` status
- Duplicate webhook calls are safely ignored
- Facilitator can view all payments and their statuses
- QR token is unique per ticket and rendered as a scannable image

## Acceptance Criteria

- [ ] Attendee clicks "Register" on an event, agrees to terms, and is redirected to HitPay
- [ ] After successful payment, attendee sees their ticket with a QR code on `/tickets`
- [ ] Hitting the webhook URL twice with the same payload does not create duplicate tickets
- [ ] Facilitator can see payment status (pending/paid/failed) for all registrants
- [ ] A second registration attempt by the same attendee for the same event is rejected
- [ ] QR token displays as a valid scannable QR code image
