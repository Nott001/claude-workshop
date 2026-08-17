# 03 — Case-insensitive, whitespace-tolerant manual code entry

## Goal

Typing `7AB2C9` or `7ab2c9` at the kiosk must resolve to code `7ab2c9`. Manual entry is the entire point of the shorter codes, so lookup input is normalized server-side in the single place both check-in endpoints already share.

## Why

The issuer always writes lowercase hex, but a human who types a code may not. Normalizing in the schema the kiosk routes already validate through (`checkinSchema`) fixes scan-lookup, typed lookup, and check-in with one change and keeps the kiosk UI untouched. The QR itself contains the canonical lowercase payload, so scans are unaffected.

## Prerequisites

- Sheets 01–02 applied (authors `[0-9a-f]{6}` codes).

## Changes

### `src/modules/kiosk/lib/checkin.ts`

Current:

```ts
export const checkinSchema = z.object({
  qr_token: z.string().min(1, "QR token is required"),
});
```

Replace with a trim-then-lowercase transform. Zod applies `.trim()` before `.min` validates, so a whitespace-only input still fails:

```ts
export const checkinSchema = z.object({
  qr_token: z
    .string()
    .trim()
    .min(1, "QR token is required")
    .transform((token) => token.toLowerCase()),
});
```

Both `GET /api/checkin/lookup` and `POST /api/checkin` already feed this schema (`parsed.data.qr_token` is what hits `findByQrToken`), so no route edits are needed. The kiosk renders the **server-stored** code from the preview, which is already lowercase — no client change.

## Tests

- `test/kiosk.test.ts`: extend the `checkinSchema` block:

```ts
it("normalizes typed codes to lowercase", () => {
  const result = checkinSchema.safeParse({ qr_token: " 7AB2C9 " });
  expect(result.success).toBe(true);
  if (result.success) expect(result.data.qr_token).toBe("7ab2c9");
});

it("still rejects a whitespace-only code", () => {
  const result = checkinSchema.safeParse({ qr_token: "   " });
  expect(result.success).toBe(false);
});
```

- `test/api-checkin.test.ts`: add one test that an uppercase POST reaches the DAO lowercased:

```ts
it("looks up a typed code case-insensitively", async () => {
  findByQrToken.mockResolvedValue(ticket("issued"));
  const res = await POST(post({ qr_token: "Tok-123" }));
  expect(res.status).toBe(200);
  expect(findByQrToken).toHaveBeenCalledWith({}, "tok-123");
});
```

- `test/api-checkin-lookup.test.ts`: add the mirror assertion for the GET path (e.g. `GET(get("qr_token=T0K-123"))` → `findByQrToken` called with `"t0k-123"`).

Existing cases use lowercase/alphanumeric tokens (`tok`, `tok-123`, `forged`) so their `findByQrToken` expectations still match post-transform.

## Verification gates

```
pnpm test -- test/kiosk.test.ts test/api-checkin.test.ts test/api-checkin-lookup.test.ts
pnpm typecheck
pnpm lint
pnpm format
```
