# 02 — Collision-safe code allocation at ticket issuance

## Goal

With the UNIQUE constraint gone (sheet 01), issuing must avoid giving two _live_ tickets the same code, while still reusing codes whose tickets are checked in or cancelled.

## Why

A 6-char hex code can, eventually, match a retired code — that is the point of repooling. But two **active** tickets sharing a code would let one attendee check in as the other. Only `issued` tickets count as taken; `checked_in` and `cancelled` codes are free to reuse.

## Prerequisites

- Sheet 01 applied: `generateQrToken()` returns 6 hex chars; the migration exists.

## Changes

### `src/shared/db/dao/ticket.dao.ts`

Add one lookup beside the existing `findByQrToken` (it posts with the same service-role client as every other ticket path, so no RLS/grants change):

```ts
/** Whether a code is currently held by a live ticket. Retired (checked-in or
 * cancelled) tickets release their code back to the pool. */
export async function findActiveByQrToken(supabase: DbClient, qrToken: string): Promise<Ticket | null> {
  const { data, error } = await supabase
    .from("TICKET")
    .select("*")
    .eq("qr_token", qrToken)
    .eq("status", "issued")
    .maybeSingle();
  throwOnDbError(error, "ticket.dao.findActiveByQrToken");
  return data;
}
```

### `src/modules/commerce/lib/fulfillment.ts`

`fulfillPaidPayment` currently draws exactly one code:

```ts
const qrToken = generateQrToken();
```

Wrap allocation in a bounded retry that refuses a code a live ticket already holds (reuse the new DAO helper):

```ts
async function generateAvailableQrToken(supabase: DbClient): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const token = generateQrToken();
    if (!(await ticketDao.findActiveByQrToken(supabase, token))) return token;
  }
  // 16M codes: exhausted retries means something is pathologically wrong,
  // not a functioning queue. Fail loudly rather than issue a duplicate.
  throw new Error("Could not allocate a unique QR token");
}
```

and call `const qrToken = await generateAvailableQrToken(supabase);`.

Keep `await` in the flow — do not fire the check in `afterResponse`; the token must be decided before `ticketDao.create`.

## Tests

`test/payment-gateway.test.ts` mocks `@/shared/db/dao/ticket.dao` with only `{ create, findByPaymentId, updateStatus }`. Add `findActiveByQrToken` to the mock (default: resolves `null`, i.e. no collision) so the new call does not crash existing tests, then add:

```ts
const { findActiveByQrToken } = vi.hoisted(() => ({ findActiveByQrToken: vi.fn() }));
// in vi.mock factory: findActiveByQrToken,
// in beforeEach: findActiveByQrToken.mockResolvedValue(null);

it("re-draws a token when the first draw collides with a live ticket", async () => {
  findActiveByQrToken
    .mockResolvedValueOnce({ id: 1 }) // first draw taken
    .mockResolvedValueOnce(null); // second draw free
  await new SimulatedPaymentGateway().createPayment(OPTIONS);
  const tokens = [...findActiveByQrToken.mock.calls, ticketCreate.mock.calls];
  const issued = ticketCreate.mock.calls[0][1].qr_token;
  expect(issued).toMatch(/^[0-9a-f]{6}$/);
  expect(ticketCreate).toHaveBeenCalledTimes(1);
});
```

Tighten the existing "issues a ticket carrying a QR token" assertion from `toMatch(/\S/)` to `toMatch(/^[0-9a-f]{6}$/)` so the shortened format stays pinned here too.

## Verification gates

```
pnpm test -- test/payment-gateway.test.ts test/commerce.test.ts
pnpm typecheck
pnpm lint
pnpm format
```

Commits: none needed yet unless you prefer a separate commit — sheets 03–06 still build on this branch; committing incrementally is fine with `feat:`/`test:` prefixes.
