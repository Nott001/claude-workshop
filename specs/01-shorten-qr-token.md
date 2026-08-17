# 01 — Shorten the QR token to 6 hex chars

## Goal

Make the QR/typed token human-typeable: 6 lowercase hex characters (`[0-9a-f]{6}`, 16 million codes) instead of the current 64-char hex blob.

## Why

Issue #240: the current `crypto.randomBytes(32).toString("hex")` token is a 64-char string that nobody can type into the kiosk's manual entry field. A 6-char code is easy to read off a screen and type. Codes are meant to be **repooled**: once a ticket is checked in or cancelled its code can be re-issued, so the DB-level UNIQUE constraint must go (that migration is part of this sheet). Uniqueness among _live_ tickets is enforced application-side in sheet 02.

## Prerequisites

- Branch off `development` already created (e.g. `feat/short-qr-tokens`).
- Do not create the schemas from sheets 02–06 yet; run sheets in order.

## Changes

### `src/modules/commerce/lib/payment-state.ts`

`generateQrToken()` currently:

```ts
export function generateQrToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
```

Replace with a 3-byte draw so the output is 6 hex chars:

```ts
export function generateQrToken(): string {
  return crypto.randomBytes(3).toString("hex");
}
```

### `supabase/migrations/00007_short_qr_token.sql` (new file)

Do **not** edit `00001_initial_schema.sql` (AGENTS.md: never edit an existing migration). Drop the UNIQUE constraint so retired codes can be repooled; keep NOT NULL and the `idx_ticket_qr` lookup index.

```sql
-- Issue #240: QR tokens shrink from 64 hex chars to 6, and a 16M-code space
-- cannot stay unique in a relational sense forever. Codes are repooled when a
-- ticket is checked in or cancelled, so uniqueness is enforced application-side
-- against active (issued) tickets only, at issue time. The NOT NULL and the
-- btree index for lookups stay; only the global constraint goes.

ALTER TABLE "public"."TICKET" DROP CONSTRAINT "TICKET_qr_token_key";
```

## Tests

`test/commerce.test.ts` pins the old shape at "generates a 64-character hex string". Replace with:

```ts
it("generates a 6-character hexadecimal code", () => {
  const token = generateQrToken();
  expect(token).toHaveLength(6);
  expect(/^[0-9a-f]+$/.test(token)).toBe(true);
});

it("generates distinct codes in a small batch", () => {
  const tokens = new Set(Array.from({ length: 100 }, () => generateQrToken()));
  expect(tokens.size).toBe(100);
});
```

(The 100-draw distinctness check stays valid: 100 draws out of 16.7M collide with probability ~0.03%.)

## Verification gates (run before committing this sheet)

```
pnpm test -- test/commerce.test.ts
pnpm typecheck
pnpm lint
pnpm format
git diff --stat   # should touch exactly: payment-state.ts, 00007_short_qr_token.sql, commerce.test.ts
```

Commit as `feat: shorten QR check-in tokens to 6 hex characters`. Note in the body why: manual kiosk entry and code reuse.

> Do not run `pnpm db:reset` yet — it is done once in sheet 06 after all migrations exist.
