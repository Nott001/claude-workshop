# 05 — Provider selection: loopback guard wins

## Goal

`createDefaultProvider()` picks the email transport by a single decision table.
The loopback guard is the load-bearing rule: under `next dev` the only legal
SMTP destination is 127.0.0.1 — dev credentials can never reach a real relay by
accident.

## Where

- `src/shared/integrations/email/index.ts` — `createDefaultProvider()`,
  `pointsAtLocalStack()`, `devCaptureBoxConfig()`, `emailDeliveryIsLocal()`,
  `configureEmailService()`, `resetEmailService()`.
- `src/shared/integrations/email/providers/console.ts`,
  `providers/unconfigured.ts`.

## Why

- Decision order is a guard chain, each branch provable on its own:
  1. SMTP configured **and** on workerd → real SMTP (isolate can socket).
  2. SMTP configured **and** loopback → SMTP via Node connector (plaintext,
     spec 03) — explicit config to a capture box.
  3. No SMTP config **and** not workerd **and** `NEXT_PUBLIC_SUPABASE_URL`
     points at the local stack → **auto-route** to `devCaptureBoxConfig()`
     (spec 06): dev needs zero SMTP settings to see mail.
  4. Otherwise: workerd → `UnconfiguredEmailProvider` (refuses, names the
     missing secrets); not workerd → `ConsoleEmailProvider` (logs only).
- Case 4's split is the truthfulness core: a worker that forgot its secrets
  must not _pretend_ to have sent — it refuses and says what is missing.
- `emailDeliveryIsLocal()` is `instanceof ConsoleEmailProvider`, the single
  signal the reset form uses to decide whether handing a minted link to the
  browser is worth doing.

## Steps

1. `readSmtpConfig()` from `process.env`; `null` means "not configured".
2. Guard chain as above, in that exact order.
3. `pointsAtLocalStack()` = `NEXT_PUBLIC_SUPABASE_URL` host is loopback —
   the exact value `pnpm db:env local` writes.
4. `configureEmailService(provider)` replaces the lazily-built singleton.
5. `resetEmailService()` nulls it so tests can swap providers.

## Verify

- `pnpm test`: email-integration suite asserts each of the 4 branches
  (workerd-with-mailbox speaks SMTP; loopback-under-Node speaks SMTP; local
  stack auto-routes; hosted-target keeps the console).
- Output of `pnpm cf:preview` shows SMTP only when `.dev.vars` sets it.
