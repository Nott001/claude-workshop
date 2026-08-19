# 05 — Predicate/ownership 403s through `forbidden()`; mop up mixed files

## Run order

Fifth. Requires sheets 03–04 (guard conversion) and 02 (`forbidden`).

## Motivation

Three leftovers keep the hand-rolled `{ error: "Forbidden" }, { status: 403 }`
alive after sheets 03–04:

1. Ownership / read-authorisation predicates that were _already_ behind a guard
   (`support/[messageId]`, `speakers/me/events/[eventId]`, `speakers/[id]`).
2. Guards that flatten a service-thrown 403 into a bare "Forbidden"
   (`checkin`, `checkin/lookup`).
3. Mixed files whose Pattern A GET half and Pattern B POST half live in one file
   (`events/[id]/speakers`).

The goal of this sheet is to kill every remaining literal guard refusal in a
route file, which is exactly what sheet 06's sweep will then enforce.

## Changes

### `src/app/api/support/[messageId]/route.ts` (GET, DELETE)

- Convert both `requireAuth` + inline 401 branches to `requireRole()` +
  `guardFailure` (sheet 03 rule), rename `user` → `guard.user`.
- In `authorizeMessageRead`, replace its `return NextResponse.json({ error: "Forbidden" }, { status: 403 });`
  with `return forbidden();` and import `forbidden` from `@/modules/auth/lib/guard-response`.
  The helper's `NextResponse | null` contract stays.

### `src/app/api/speakers/me/events/[eventId]/route.ts` (GET)

- Convert to `requireRole()` + `guardFailure`.
- The two domain 403s with **custom** messages — `"Not a speaker"` and
  `"Not assigned to this event"` — stay as-is (they are not the "Forbidden"
  body the guard-rail targets; do not rewrite to `forbidden()`).

### `src/app/api/speakers/[id]/route.ts` (PATCH, DELETE)

Already Pattern A. Replace the two inline
`NextResponse.json({ error: "Forbidden" }, { status: 403 })` (PATCH ownership,
DELETE ownership) with `forbidden()`. Do not touch the two-tier PATCH fallback
(`requireMinRole(FACILITATOR)` else `requireRole(SPEAKER)`) — it is intentional
and already uniform.

### `src/app/api/events/[id]/speakers/route.ts`

- POST is auth-only: sheet 03 rule → `requireRole()` + `guardFailure`.
- GET already guards with `requireMinRole(SPEAKER)` + `guardFailure`; its one
  inline `{ error: "Forbidden" }, { status: 403 }` (unassigned exact-speaker)
  → `forbidden()`.
- The `EventServiceError` mapping block stays for sheet 07.

### `src/app/api/checkin/route.ts` (POST) and `checkin/lookup/route.ts` (GET)

Both already `requireMinRole(FACILITATOR)` + `guardFailure`. Each flattens a
`loadEventOr403` 403 into a literal `{ error: "Forbidden" }, { status: 403 }`;
replace that literal with `forbidden()`.

### Verify-only (no edits expected; confirm on the way through)

- `tickets/route.ts`, `tickets/[paymentId]/route.ts`, `tickets/detail/[ticketId]/route.ts`,
  `payments/[id]/route.ts`, `upload/profile-image/route.ts` — already the Pattern A
  `requireRole()` + `guardFailure` idiom; confirm no literal `"Forbidden"`/401
  refusal remains.
- `organization/route.ts`, `courses/route.ts` — Pattern A guards; their custom-
  message 403s (`"You cannot invite a role you do not outrank"`,
  `"You are not assigned to this event"`) are domain denials and stay.

## Documented exceptions — soft reads that keep `requireAuth`

These serve anonymous callers by design; do **not** convert them. They are the
remaining home of `AuthUser | null`:

| File                                              | Why it is soft                                              |
| ------------------------------------------------- | ----------------------------------------------------------- |
| `src/app/api/events/route.ts` (GET)               | public listing, role-scoped                                 |
| `src/app/api/events/[id]/route.ts` (GET)          | public detail; meeting-link visibility per caller           |
| `src/app/api/community/route.ts` (GET)            | public cards, role gives more                               |
| `src/app/api/speakers/me/events/route.ts` (GET)   | anonymous answers `[]`                                      |
| `src/app/api/storage/[bucket]/[...path]/route.ts` | `resolveAccess` must allow public covers before the session |

Pages keep `requireAuth` too: `src/app/user/page.tsx`, `src/app/email-verified/page.tsx`.

## Tests

- Update the affected files' mocks per sheet 03 (`api-support-message-delete`,
  `api-support-get`, `api-event-speakers-route`, `api-speaker-unassign-route`,
  `api-checkin`, `api-checkin-lookup`, `api-storage`, `api-role-scoping`, …).
- Denial assertions already expecting 403 for predicates stay 403 (they now ride
  `forbidden()`); anonymous paths are 401 via `guardFailure`.

## Acceptance

After this sheet, **no route file contains a literal guard refusal**:

```sh
rg -n 'error: "(Unauthenticated|Forbidden)", \}, \{ status: (401|403) \}' \
  'src/app/api/**/route.ts'   # globs vary by shell; check across all route files
```

or equivalently `rg -n '"Forbidden"|Unauthenticated'` should only match the
custom-message domain 403s and `guardFailure`-handled code paths, never a
`NextResponse.json({ error: "Forbidden" }, { status: 403 })` literal.

## Verification

```sh
pnpm format && pnpm lint && pnpm typecheck && pnpm test
```

## Commit

```
refactor: render every remaining entitlement denial through forbidden()

Ownership checks, read authorisation and the check-in flatten of a
service-thrown 403 still hand-rolled the Forbidden body sheets 02-04
centralised. Routing them through forbidden() leaves exactly one shape for
every guardable refusal ahead of the sheet-06 sweep that enforces it.
```

No CHANGELOG entry (before: identical bodies, no wire change).
