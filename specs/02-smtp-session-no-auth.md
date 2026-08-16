# 02 — SMTP session: no-AUTH fall-through

## Goal

Let the SMTP client connect to the local inbucket capture box, which
advertises **no** AUTH mechanism. A server that announces no mechanism must not
fail; it proceeds unauthenticated and the MTA decides.

## Where

- `src/shared/integrations/email/providers/smtp/session.ts` — `authenticate()`.
- Test: in-memory duplex pairs drive the protocol with no network
  (`test/.../smtp` mocks, vitest).

## Why

- inbucket is an open relay on localhost — nothing to prove, so a login step is
  a non-sequitur that would drop every piece of dev mail.
- GoTrue reaches the same capture box by docker-network alias (`1025`); the app
  must succeed against exactly the pickiness inbucket has (none).
- Preserve the preference order: PLAIN (one round trip) → LOGIN (older servers)
  → silently unauthenticated. Never RCPT/DATA a server that _did_ advertise an
  unsupported method like CRAM-MD5 — that is a real relay, not a capture box,
  and pushing mail without creds there is exactly the accident we are avoiding.
- Reason to select none rather than error: the absence of an `AUTH` capability
  line is inbucket's identity signal. Treating it as fatal would make every
  local reset fail for no reason.

## Steps

1. Parse the `AUTH` capability line from the EHLO reply.
2. If it contains `PLAIN`: send `AUTH PLAIN <base64(\0user\0pass)>`, expect `235`.
3. Else if it contains `LOGIN`: do the two-step `AUTH LOGIN` dance (`334` →
   username base64 → `334` → password base64 → `235`).
4. Else: return without writing anything; continue straight to `MAIL FROM`.
5. Keep `dotStuff` transparent on the message body (a leading `.` on a DATA
   line would end the transfer early; base64 bodies never produce one, headers
   can).

## Verify

- `pnpm test` green; session specs assert a server with no AUTH finishes the
  session and delivers.
- `curl`/inbucket: local reset mail has a `Received` from the app process.
