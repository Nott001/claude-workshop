# 04 — Delete-account confirmation hook

## Purpose

Sheet 03 added the endpoint. This sheet adds the client state that drives the
confirmation modal (sheet 05): whether it is open, what is typed, whether the
submit is in flight, whether the typed phrase matches exactly, and what
happens when the user confirms — the `DELETE` call, the toast on failure, and
sign-out on success. Keeping the state in a hook keeps the modal component
thin and makes the phrase gate testable without a DOM.

## Background (current code)

- `src/modules/user/lib/use-account-settings.ts` holds all account-settings
  state and exposes a `ToastData` / `ActiveToast` shape (`:14-20`) with a
  keyed re-render (id increments so each message remounts). The delete flow
  reuses that `{ title, description, type }` shape for error reporting.
- `useSession()` from `src/modules/auth/components/session-context.tsx` owns
  `signOut` (`:115-121`): `supabase.auth.signOut()` → `setUser(null)` →
  `router.replace("/")`. After the auth identity is deleted server-side, the
  Supabase call may reject — the navigation must still run, so the hook
  catches and falls through.
- The existing hook calls the route with `fetch("/api/auth/me",
{ method: ... , headers })` (e.g. `use-account-settings.ts:287-291`) — no
  `credentials` flag needed; Supabase cookies ride along.
- The confirm button's enabled state is `phrase` equals the literal
  `Delete My Account`. Keeping the check in the hook means the modal (sheet 05) just binds `canConfirm` and cannot drift from the phrasing.

## Scope

A new client hook `src/modules/user/lib/use-delete-account.ts`, plus hook
tests. No changes to the modal, route or service.

## Steps

### 1. Create the hook

New file `src/modules/user/lib/use-delete-account.ts` with `"use client"`.
It returns:

- `open: boolean` — dialog visibility; `openDialog()` / `closeDialog()`.
- `phrase: string` and `setPhrase(value: string)` — bound to the modal input.
- `canConfirm: boolean` — `phrase.trim() === "Delete My Account"`.
- `submitting: boolean` — true while the request is in flight; disables the
  confirm button and repaints it "Deleting…".
- `error: string | null` — set on a failed attempt, cleared by the next
  `setPhrase` (the keystroke is the retry — same convention as the settings
  hook's field errors, `use-account-settings.ts:92-96`).
- `confirm(): Promise<void>` — the full flow below.

### 2. Implement `confirm()`

```ts
async function confirm() {
  if (!canConfirm || submitting) return;
  setSubmitting(true);
  setError(null);
  try {
    const res = await fetch("/api/auth/me", { method: "DELETE" });
    if (!res.ok) throw new Error("delete failed");
    closeDialog();
    // The identity is already gone server-side; signOut may reject because
    // the token no longer belongs to anyone, so navigation must not depend
    // on it resolving.
    await signOut().catch(() => {});
  } catch {
    setError("We could not delete your account. Please try again.");
  } finally {
    setSubmitting(false);
  }
}
```

- No body is sent — the route acts on the caller (sheet 03).
- On success the dialog closes and `signOut()` navigates to `/`; the
  `SIGNED_OUT` handler in the session provider
  (`session-context.tsx:86-89`) also refetches `/api/auth/me`, which now 401s
  into an inert guard, and the navbar already dropped the user via `setUser`.
- `setError` is intentionally not rethrown; the modal (sheet 05) renders the
  message and the button stays usable for a retry.

### 3. Hook tests

New file `test/use-delete-account.test.tsx`, following the conventions of
`test/use-account-settings.test.tsx` (mock `useSession` from
`@/modules/auth/components/session-context` and `global.fetch`):

- `canConfirm` is false until the phrase matches `Delete My Account`
  exactly (whitespace-trimmed), true afterward;
- `confirm()` issues `DELETE /api/auth/me` with no body while the phrase
  matches, and returns without fetching when it does not;
- a non-ok response (or a thrown fetch) sets `error`, leaves the dialog open,
  and does not call `signOut`;
- an `ok` response closes the dialog and calls `signOut`, and the sign-out
  rejection is swallowed (navigation still happens through the mocked
  `signOut`'s own routing).

## Verify

```
pnpm format && pnpm lint && pnpm typecheck
pnpm test
```

Full suite green; coverage thresholds not lowered.

## Commit

```
feat(user): add delete-account confirmation hook

Body: the modal needs open/phrase/submitting state and a confirm that hits
DELETE /api/auth/me then signs out. Keeping it in a hook puts the phrase gate
and the failure path in one testable unit and lets the modal bind state
without owning fetch or navigation. Sign-out rejection is swallowed because
the auth identity is already deleted when it runs.
```

## Definition of done

- `use-delete-account` exposes open/phrase/canConfirm/submitting/error and a
  `confirm()` that calls `DELETE /api/auth/me`, closes on success, signs out,
  and reports a retryable error on failure.
- `test/use-delete-account.test.tsx` covers the gate, the fetch, the failure
  and the sign-out swallow; suite green.
