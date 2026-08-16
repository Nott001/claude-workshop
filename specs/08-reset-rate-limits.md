# 08 — Reset rate limits: DB-backed, fail-closed on the count

## Goal

Back the reset rate limiter in the `public.PASSWORD_RESET_ATTEMPT` table
instead of process memory, so limits survive restarts and load. Attempts are
recorded per email and per IP within a rolling window; over-limit mints are
refused with a category the form can render.

## Where

- `src/shared/db/dao/password-reset.dao.ts` — `recordAttempt`, `countByEmail`,
  `countByIp`, `deleteByEmail`.
- `src/modules/auth/lib/password-reset.ts` — window constants
  (`RESET_WINDOW_MS = 15 min`, `RESET_MAX_PER_EMAIL = 3`,
  `RESET_MAX_PER_IP = 10`), `ResetOutcome.rate_limited`, `normalizeEmail`.
- `supabase/migrations/00001_initial_schema.sql` — `public.PASSWORD_RESET_ATTEMPT`
  (`id` identity, `email` not null, `ip` nullable, `created_at` default now) with
  indexes `idx_password_reset_attempt_email`, `idx_password_reset_attempt_ip`
  (btree, `(email, created_at DESC)` / `(ip, created_at DESC)`), RLS enabled,
  `GRANT ALL … TO "service_role"` (line 1427) — the role the DAO's client uses.
- `test/password-reset.test.ts` — mocks `recordAttempt`/`countBy*`.

## Why

- Memory counters under `pnpm dev` reset on every hot reload and never shared
  across isolates; the DB is the only stable ledger on both hosts.
- The decision in `preparePasswordReset` (password-reset.ts:79-90): a request
  is **counted before it is answered**, and the counts are read before the
  address lookup. A prober is throttled on the question itself, not on how
  often its lookup happens to be answered "yes".
- Fail-closed lives on the **read side**: an unreadable counter must not open
  the flood gates, so `countSince` returns `Number.MAX_SAFE_INTEGER` on error
  (dao line 25) — the request is refused. The insert, by contrast, only warns:
  a failed insert must not take the whole flow down mid-campaign, because the
  count will soon refuse anyway.
- Per-email (3) stops one mailbox being flooded however many hosts ask;
  per-IP (10) stops one host walking many addresses.
- `normalizeEmail` lowercases/trims so casing cannot buy extra attempts.

## Steps

1. Confirm `public.PASSWORD_RESET_ATTEMPT` exists in the baseline migration with
   the two descending indexes and `service_role` grants (a missing grant would
   fail the _whole_ query with 42501 — AGENTS.md warning).
2. `recordAttempt(supabase, email, ip)` inserts; a throw only warns.
3. Both counts read in one `Promise.all` (common case reads both anyway);
   each returns `MAX_SAFE_INTEGER` on read error — fail closed.
4. In `preparePasswordReset`: record first, then if either count exceeds its
   max → `rate_limited`, before any lookup or mint.
5. `ip` is `null` when no `CF-Connecting-IP` header exists (dev) — that count
   degenerates to `Promise.resolve(0)` and the email window stands alone.
6. Tests cover: window expiry, per-email over-limit, per-ip over-limit, and
   a failing count → `rate_limited`.

## Verify

- `pnpm test` green for all limit branches.
- Under `pnpm dev`, 3+ rapid resets to one address → `rate_limited`;
  after 15 min the same address succeeds again.
