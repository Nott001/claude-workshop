# Debug Payment Bypass

## Overview

During development, you may want to skip the HitPay payment flow and directly issue tickets. This is useful for testing event registration, ticket generation, QR codes, and check-in flows without needing a real payment provider.

## Enabling

Set the following environment variable:

```
NEXT_PUBLIC_DEBUG_BYPASS_PAYMENT=true
```

## What it does

When `NEXT_PUBLIC_DEBUG_BYPASS_PAYMENT=true`, the `POST /api/payments` endpoint:

1. Creates a `PAYMENTS` record as usual (status `pending`)
2. Instead of calling HitPay's `createPayment()`, it immediately:
   - Updates the payment status to `paid`
   - Generates a QR token and inserts a `TICKETS` record
3. Returns a `checkout_url` pointing to the local checkout page, which will poll and find the payment is already paid

If a pending payment already exists for the user+event, it also bypasses and issues the ticket immediately.

## What it does NOT do

- It does not modify the register API (`POST /api/events/[id]/register`) — the eligibility check (duplicate ticket, duplicate pending payment) still runs.
- It does not send email notifications.
- It does not affect the `POST /api/payments/webhook` endpoint (HitPay webhook handler).

## Testing the full flow with bypass

1. Set `NEXT_PUBLIC_DEBUG_BYPASS_PAYMENT=true` in your `.env.local`
2. Restart the dev server
3. As an attendee, navigate to an active event and click **Register**
4. You'll be redirected to the checkout page, which will immediately find the payment is paid and redirect to `/tickets`
5. The ticket will appear in the **My Tickets** page with a QR code

## Before production

Remove this env var and ensure HitPay is properly configured. See `lib/hitpay/index.ts` for the payment integration.