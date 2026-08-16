# 03 — DELETE /api/auth/me route

## Purpose

Sheet 02 produced the orchestration. This sheet exposes it as `DELETE` on the
existing `/api/auth/me` route, so the confirmation modal (sheets 04–05) has a
single self-service endpoint that acts on the _authenticated caller only_ and
needs no body.

## Background (current code)

- `/api/auth/me` currently exports `GET` (`src/app/api/auth/me/route.ts:9-30`)
  and `PATCH` (`:32-116`). Both call `requireAuth()` and the PATCH additionally
  resolves `getCurrentUserId()` (the auth UUID) at `:33-41`, because
  `requireAuth()` returns an `AuthUser` without `auth_user_id`.
- `src/middleware.ts:64` exempts `/api/auth/*` from middleware gating, so the
  handler must self-guard with `requireAuth()` — exactly what the existing
  GET/PATCH handlers already do.
- The route module already imports `requireAuth`, `getCurrentUserId`,
  `getServiceClient` and the DAOs; the DELETE handler imports
  `deleteAccount` from sheet 02 and adds nothing else.
- Error convention is `{ error }` with a status; success conventions vary, and
  the `{ ok: true }` shape matches the upload DELETE
  (`src/app/api/upload/profile-image/route.ts:94`) and support teardown routes.

## Scope

One new exported handler in the existing route file, plus route tests. No
client, DAO or service changes.

## Steps

### 1. Add the handler

Append to `src/app/api/auth/me/route.ts`:

```ts
export async function DELETE() {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const authUserId = await getCurrentUserId();
  if (!authUserId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  try {
    await deleteAccount({
      userId: user.id,
      authUserId,
      email: user.email,
      role: user.role,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not delete your account. Please try again." }, { status: 500 });
  }
}
```

Notes:

- No body is read — the target is always the caller, by design. The user's own
  email comes from `requireAuth()` and is passed to the service, which needs it
  to purge `PASSWORD_RESET_ATTEMPT` before anonymizing (sheet 02, step 6).
- `user.email`, `user.id` and `user.role` are read **before** the request runs
  so the raw address reaches the purge step intact.
- A thrown service error maps to a single generic 500. The route does not leak
  inner failure messages; the described abort-before-point-of-no-return keeps
  any such error retryable.

### 2. Route tests

New file `test/delete-account-api.test.ts`, mirroring
`test/api-auth-me.test.ts:6-19` (`vi.hoisted` doubles for `requireAuth` and
`getCurrentUserId`, `vi.mock` for `@/shared/db/client` and the service
module). Assert on behavior:

- unauthenticated (`requireAuth` → null) returns `401 { error:
"Unauthenticated" }` and the service is not called;
- `getCurrentUserId` → null also returns 401;
- success: `requireAuth` → a user and `getCurrentUserId` → a UUID makes
  `deleteAccount` resolve and the handler returns `200 { ok: true }`, having
  called the service with `{ userId, authUserId, email, role }`;
- failure: `deleteAccount` rejects → `500 { error: "Could not delete your
account. Please try again." }`.

## Verify

```
pnpm format && pnpm lint && pnpm typecheck
pnpm test
```

Full suite green; coverage thresholds not lowered.

## Commit

```
feat(auth): delete the account via DELETE /api/auth/me

Body: the confirmation flow needs one self-service endpoint that acts on the
authenticated caller, requires no body, and returns ok only after the
account service has anonymized the row and removed the auth identity. Hanging
DELETE off the existing /api/auth/me route keeps the guard (requireAuth, plus
getCurrentUserId for the auth UUID) exactly where the PATCH already has it.
```

## Definition of done

- `DELETE /api/auth/me` returns `401` without a session, `200 { ok: true }`
  after a successful `deleteAccount`, and a generic `500` when the service
  throws.
- The route never accepts a body and only ever acts on the caller.
- `test/delete-account-api.test.ts` covers the three behaviors; suite green.
