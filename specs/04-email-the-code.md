# 04 — Put the short code in the registration email

## Goal

The `ticket_issued` email must include the attendee's short code in plain text (HTML **and** the plain-text part), so someone without a working camera can still check in by typing what the QR encodes.

## Why

Issue #240: "send these shorter codes inside the email when a user registers to an event." Today the email carries only the QR image (`qrDataUrl`); the raw token never appears. The code is the fallback credential, so it must be human-readable and easy to copy from the inbox, not only encoded in a bitmap.

## Prerequisites

- Sheets 01–03 applied.

## Changes

### `src/shared/integrations/email/templates/ticket-issued.ts`

Interface `TicketIssuedParams` gains a required `code` (the code is always known — the caller either just generated it or is re-sending a stored one):

```ts
export interface TicketIssuedParams {
  name: string;
  eventTitle: string;
  eventDate: string;
  code: string;
  qrDataUrl?: string;
}
```

In `ticketIssuedHtml`, between the "Present the QR code" paragraph and the QR `<img>`, add a code callout (escape it like every other interpolated value):

```ts
<p style="margin:0 0 12px">Your check-in code: <strong style="font-family:monospace">${escapeHtml(params.code)}</strong></p>
```

In `ticketIssuedText`, replace the line about staff lookup with the concrete code (plain-text part is deliberately unescaped):

```ts
`Your check-in code: ${params.code}`,
`Present the QR in this email at the entrance, or type this code into the check-in kiosk to check in.`,
```

### `src/shared/integrations/email/send-notification.ts`

`EmailPayloads.ticket_issued` gains the required field and the dispatch passes it through:

```ts
ticket_issued: { eventTitle: string; eventDate: string; code: string; qrDataUrl?: string };
```

```ts
case "ticket_issued":
  return sendTemplatedEmail(
    emailTemplates.ticketIssued,
    { name, eventTitle, eventDate, code: params.code, qrDataUrl: params.qrDataUrl },
    to,
  );
```

### `src/modules/commerce/lib/fulfillment.ts`

The initial-issue send site (inside `afterResponse`) passes the code it just allocated:

```ts
qrDataUrl: await generateQRDataUrl(qrToken),
```

add before/after it:

```ts
code: qrToken,
```

### `src/app/api/events/[id]/attendees/[userId]/resend-ticket/route.ts`

The re-send site gets `code: ticket.qr_token` alongside `qrDataUrl`.

## Tests

- `test/notifications.test.ts` — every `ticketIssued.buildHtml/buildText` call now needs `code`. Add `code: "1a2b3c"` to the existing call sites and assert:
  - HTML contains the code and the "check-in code" text.
  - Text contains the code.
  - The XSS-escape tests still pass (code is escaped via `escapeHtml`, same path as `eventTitle`).
- `test/send-email-notification.test.ts` — `ticket_issued` payloads gain `code: "1a2b3c"`; assert `payload.htmlContent`/`payload.textContent` contain it. The provider-failure log test also passes `ticket_issued` — add `code` there too (payload is now mandatory).
- `test/payment-gateway.test.ts` — extend the email `objectContaining` assertion with `code: expect.stringMatching(/^[0-9a-f]{6}$/)`. Note `afterResponse` is mocked to run inline, so the assertion sees the real value.
- `test/api-event-attendees-manage.test.ts` — the resend test's `objectContaining` gains `code: "qr-abc"` (the fixture ticket's `qr_token`).

## Verification gates

```
pnpm test -- test/notifications.test.ts test/send-email-notification.test.ts test/payment-gateway.test.ts test/api-event-attendees-manage.test.ts
pnpm typecheck
pnpm lint
pnpm format
```

## Post-change sanity

This path touches the SMTP service (sockets/streams). After all sheets are applied, sheet 06 runs `pnpm cf:preview` to prove it works in a V8 isolate before shipping — do not skip it because vitest passes.
