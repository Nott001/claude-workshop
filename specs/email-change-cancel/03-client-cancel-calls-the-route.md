# 03 — Cancel calls the route and voids the change

## Purpose

Sheet 01 added the helper that voids a pending change server-side; sheet 02
gave it a route. The client still calls nothing — `cancelEmailChange()` only
resets `emailSent`/`resendIn`/`pendingEmail`, so GoTrue keeps holding
`auth.users.email_change` and the mailed link until it expires. This sheet
makes the cancel button actually cancel: it posts to the sheet-02 route, clears
the sent state on success, and reports a failure instead of pretending a cancel
landed. This is the user-facing fix the CHANGELOG will announce.

## Background (current code)

- `cancelEmailChange()` (`src/modules/user/lib/use-account-settings.ts:370`)
  is synchronous and makes no request; its comment (`:364-368`) still records
  the sheet-12 gate FAIL ("no admin write clears new_email").
- The restore effect (`use-account-settings.ts:115-137`) reads GoTrue's
  `new_email` on reload and re-shows the pending banner. Today a dismiss
  cannot prevent that; once the route voids the change, GoTrue returns no
  `new_email`, so a reload stays clean. `test/use-account-settings.test.tsx`
  has two tests that pin the old, no-cancel behavior and must be inverted:
  - `:1247` "…without any server call" — asserts `fetch` never touches
    `CANCEL_ROUTE`.
  - `:1267` "re-shows the pending banner after a reload while GoTrue still
    holds the change".
- The section's copy test (`test/email-section.test.tsx:143-145`) justifies the
  banner text with the same stale "gate FAILed" reasoning.
- The hook's failure-reporting helpers already exist: `notify` and
  `routeError` (`use-account-settings.ts:317-325`) fold the route's
  `{ ok: false, error: { status, message } }` (and the bare 401 body) into the
  shape `authErrorMessage` expects.
- `CANCEL_ROUTE = "/api/auth/email/cancel"` already exists at
  `test/use-account-settings.test.tsx:42`.

## Scope

- `cancelEmailChange()` becomes async and calls the sheet-02 route.
- Update the two stale tests plus their comments, and add a cancel-failure
  test.
- Refresh stale sheet-12 comments in the hook and `email-section.test.tsx`.
- CHANGELOG entry.

## Steps

### 1. Make the hook cancel through the route

In `src/modules/user/lib/use-account-settings.ts`, replace the current
`cancelEmailChange()` (`:370-374`) and its comment (`:364-368`):

```ts
/**
 * Voids the pending change server-side (sheet 01/02): GoTrue's
 * email_change_token_new row is deleted and the pending fields cleared, so the
 * mailed link expires and a reload finds nothing to resurrect. The typed
 * address stays in the field — a dismissal, not a correction.
 */
async function cancelEmailChange() {
  const res = await fetch("/api/auth/email/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: unknown };

  if (!data.ok) {
    notify({
      title: "Error",
      description: authErrorMessage(routeError(data), "We could not cancel the pending change. Please try again."),
      type: "error",
    });
    return;
  }
  setEmailSent(false);
  setResendIn(0);
  setPendingEmail(null);
}
```

Notes:

- The sent state is cleared only when the route answers `ok`; a failed cancel
  keeps the banner up and surfaces an error toast, so the user is not left
  thinking a still-live link was undone.
- `routeError` already maps the route's `{ ok: false, error: { status, message
} }` and the bare `{ error: "Unauthenticated" }` 401, so an anonymous or
  broken call reports rather than swallows.
- A double-click is harmless: the route is idempotent (sheet 02) and a second
  success just clears already-cleared state.
- `newEmail` is untouched — the typed address stays in the field, matching the
  existing "returns to the form" behavior. `email-section.tsx`'s `onCancel`
  (`:65`) needs no change; the button already awaits nothing.

### 2. Update the hook tests

In `test/use-account-settings.test.tsx` (`describe("dismissing an email
change")`, `:1226-1295`):

- Rewrite the test at `:1247` to cancel through the route. Replace
  `stubSendOk`'s fetch with `respondTo(CANCEL_ROUTE, { ok: true })` after
  sending (the send stub is only needed until `emailSent` is true), then:

```ts
it("cancels through the route, keeping the typed address", async () => {
  const fetch = respondTo(CANCEL_ROUTE, { ok: true });
  const result = await getSentState();
  expect(result.current.emailSent).toBe(true);

  await act(async () => {
    await result.current.cancelEmailChange();
  });

  expect(fetch.mock.calls.some((c) => String(c[0]).includes(CANCEL_ROUTE))).toBe(true);
  expect(result.current.emailSent).toBe(false);
  expect(result.current.resendIn).toBe(0);
  // A dismissal, not a correction: the typed address stays in the field.
  expect(result.current.newEmail).toBe("grace@example.com");
  expect(result.current.toast).toBeNull();
});
```

- Rewrite the test at `:1267`: after a successful cancel the route voids the
  change, so GoTrue no longer returns `new_email` and the restore effect has
  nothing to resurrect. `getUser` resolves a user **without** `new_email`:

```ts
// The route voided the change, so a reload finds GoTrue holding nothing and
// the restore effect leaves the banner down.
it("keeps the banner down after a reload once the change was voided", async () => {
  respondTo(CANCEL_ROUTE, { ok: true });
  const { result: first, unmount } = renderHook(() => useAccountSettings());
  act(() => first.current.setNewEmail("grace@example.com"));
  await act(async () => {
    await first.current.saveChanges(submitEvent);
  });
  expect(first.current.emailSent).toBe(true);

  await act(async () => {
    await first.current.cancelEmailChange();
  });
  expect(first.current.emailSent).toBe(false);

  unmount();
  getUser.mockResolvedValue({
    data: {
      user: {
        id: 1,
        // No new_email: the cancel cleared it server-side.
      },
    },
  });
  const { result: reloaded } = renderHook(() => useAccountSettings());

  await waitFor(() => expect(reloaded.current.emailSent).toBe(false));
  expect(reloaded.current.newEmail).toBe("grace@example.com");
});
```

- Add a failure-path test inside the same describe:

```ts
it("keeps the banner and toasts when the cancel route fails", async () => {
  respondTo(CANCEL_ROUTE, { ok: false, error: { status: 500, message: "boom" } }, false);
  const result = await getSentState();
  expect(result.current.emailSent).toBe(true);

  await act(async () => {
    await result.current.cancelEmailChange();
  });

  expect(result.current.emailSent).toBe(true);
  expect(result.current.toast?.type).toBe("error");
});
```

(`getSentState` and its `stubSendOk` stay as they are; only the tests that
assert cancel behavior change.)

### 3. Refresh the stale sheet-12 comments

- In `use-account-settings.ts`, the old `cancelEmailChange` comment is replaced
  by the new one above; check nothing else still claims cancel cannot void the
  change.
- In `test/email-section.test.tsx:143-145`, the "gate FAILed" justification for
  the banner copy is now wrong twice over (the gate succeeded and cancel voids
  the change). Rewrite it to say the banner text is about the lifetime of a
  pending link, not about whether a dismiss undid it:

```
// The banner text is about a pending link's lifetime, not about a dismiss
// undoing it: while a change is pending its link is valid for the full 24h,
// and cancel voids it server-side (sheet 01/02).
```

The copy itself does not change — a pending link genuinely is valid for its
full lifetime, and cancel removes the banner rather than relabelling it.

### 4. CHANGELOG

Add a user-facing entry under the fix heading describing that canceling an
email change now expires the already-mailed confirmation link (previously it
stayed usable until it expired on its own).

### 5. Verify

```
pnpm format && pnpm lint && pnpm typecheck
pnpm test test/use-account-settings.test.tsx test/email-section.test.tsx
```

Full suite green; coverage thresholds not lowered.

Manual gate against the live stack:

1. `pnpm dev`, log in as a seeded user, open `/user`.
2. Type a new address, save → the pending banner appears with the resend
   countdown.
3. Grab the confirmation link from Mailpit (`http://127.0.0.1:54324`).
4. Click **Cancel**: the banner clears, the typed address stays in the field,
   and the resend gate resets (the countdown is gone).
5. Click the mailed link from step 3 → the browser lands on
   `/email-link-expired` instead of completing the change.
6. Reload `/user` → the pending banner does not come back.

## Commit

```
fix(auth): canceling a pending email change expires its mailed link

Body: cancel only cleared the client's sent state, so GoTrue kept the
email_change_token_new row and the mailed link alive for the full 24h — a
cancel was cosmetic. The button now posts to the sheet-02 route, which voids
the change server-side; a failed cancel keeps the banner and surfaces an error
toast instead of pretending it landed. A reload no longer resurrects the
banner because GoTrue no longer reports a pending address.
```

## Definition of done

- Canceling a pending email change calls `POST /api/auth/email/cancel` and
  clears the sent state only on success.
- A failed cancel keeps the banner and shows an error toast.
- The typed address stays in the field; a reload shows no pending banner.
- Stale sheet-12 comments are gone; CHANGELOG carries the user-facing fix.
