# 01 — Cancel voids a pending email change at the source

## Purpose

Canceling a pending email change currently clears only the client's sent
state; GoTrue keeps `auth.users.new_email` and the `email_change_token_new`
row in `auth.one_time_tokens`, so the mailed link stays valid for the full 24
hours. A resend to a _different_ address kills the old link only as a side
effect of `CreateOneTimeToken` clearing the prior token row. This sheet gives
cancel a real, idempotent server-side effect: it expires the sent link and
clears the pending change record, so a stale link click lands on the
`/email-link-expired` page (sheet 06) instead of silently changing the email.

## Background (current code)

- `cancelEmailChange()` in `src/modules/user/lib/use-account-settings.ts:370`
  only resets `emailSent`, `resendIn` and `pendingEmail`. No request is made,
  and GoTrue is left holding the pending change until it expires.
- GoTrue v2.195.0 (supabase/auth `0522e7b`) stores email-change tokens in
  `auth.one_time_tokens` (single-confirm: one row of type
  `email_change_token_new`). The pending address lives in `auth.users`
  `email_change` (serialized as `new_email`) with `email_change_sent_at`.
- GoTrue has no "cancel email change" endpoint, and the admin write path does
  not clear `new_email` (sheet-12 gate FAIL).
- PostgREST exposes only the `public` and `graphql_public` schemas
  (`supabase/config.toml:13`), so the app cannot touch `auth.*` through the
  data API. The existing seam is a `SECURITY DEFINER` function in `public`
  running as its owner (`public.qa_message_visible`, migration 00004/00005).
- `test/migration-grants.test.ts:36-43` asserts the exact migration list and
  must learn about the new file.

## Scope

- A new numbered migration adding `public.cancel_pending_email_change()` and
  its grants. No changes to the app code, the send route, or the client hook.
- The migration-grants test list update.

## Steps

### 1. Add the migration

New file `supabase/migrations/00006_cancel_pending_email_change.sql`:

```sql
-- Cancel voids a pending email change at the source. GoTrue keeps the
-- one_time_tokens row and auth.users.email_change live until the link
-- expires, so a plain client-side dismiss left the mailed link usable for 24h.
-- Deleting the token is what makes a stale link fail as otp_expired (sheet 06);
-- clearing the user's fields stops the reload-restore effect from re-showing
-- the pending banner and resets the 60s resend gate. Runs as its owner through
-- the same SECURITY DEFINER seam as public.qa_message_visible.

CREATE OR REPLACE FUNCTION "public"."cancel_pending_email_change"()
RETURNS void
LANGUAGE sql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  DELETE FROM "auth"."one_time_tokens"
  WHERE "user_id" = auth.uid()
    AND "token_type" IN ('email_change_token_new', 'email_change_token_current');
  UPDATE "auth"."users"
  SET "email_change" = '',
      "email_change_sent_at" = NULL,
      "email_change_token_new" = '',
      "email_change_token_current" = '',
      "email_change_confirm_status" = 0
  WHERE "id" = auth.uid();
$function$;

ALTER FUNCTION "public"."cancel_pending_email_change"() OWNER TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."cancel_pending_email_change"() TO "authenticated";
```

(No `service_role` grant: a service key carries no JWT `sub`, so `auth.uid()`
is NULL under it and the helper would be a silent no-op — granting it would
advertise a path that cannot work.)

`email_change` is reset to `''`, not `NULL`, on purpose. The seed's clean state
is `''` (`supabase/seed.sql:45`), and GoTrue v2.195.0 scans that column into a
plain Go `string` — a `NULL` makes every later `getUser`/`updateUser` for the
user answer 500 (`sql: Scan error ... converting NULL to string is
unsupported`). This was caught by the manual gate below when a GoTrue
`updateUser` corrupted a seed user into exactly that state. The other cleared
fields keep their clean defaults: `email_change_sent_at` NULL,
`email_change_token_new/current` `''`, `email_change_confirm_status` 0.

The function is scoped by `auth.uid()` so a caller can only cancel their own
pending change; it needs no arguments. It is idempotent: with nothing pending
the `DELETE` and `UPDATE` match no rows and the call still succeeds. `SET
search_path TO 'public'` and fully-qualified `auth.*` references keep the
helper from resolving names in an attacker-controlled schema.

### 2. Update the migration-grants test

In `test/migration-grants.test.ts`:

- Extend the exact migration list at `<:36-43>` so it includes the new file
  after `00005_qa_message_policy_staff.sql`.
- Add a pin test for the new helper, mirroring the 00004/00005 tests that pin
  `qa_message_visible`:

```ts
// The email-change cancel helper is the same SECURITY DEFINER seam. It is
// scoped by auth.uid() (a caller can only void their own pending change) and
// must not be callable by anon or from a service key, which has no sub claim.
it("scopes the email-change cancel helper to the caller's own change", () => {
  const cancel = migrations().find((f) => f.name === "00006_cancel_pending_email_change.sql");
  expect(cancel, "00006 must exist to hold the helper").toBeDefined();
  expect(cancel!.sql).toMatch(/cancel_pending_email_change/);
  expect(cancel!.sql).toMatch(/SECURITY DEFINER/s);
  expect(cancel!.sql).toMatch(/auth\.uid\(\)/);
  expect(cancel!.sql).toMatch(/GRANT EXECUTE ON FUNCTION "public"\."cancel_pending_email_change"\(\) TO "authenticated"/);
  expect(cancel!.sql).not.toMatch(/TO "anon"/);
  expect(cancel!.sql).not.toMatch(/TO "service_role"/);
});
```

### 3. Apply the migration to the local stack

Run `pnpm supabase db reset` — this wipes the local dev database and re-runs
`supabase/seed.sql` (dev-only, confirmed). Verify the function exists and is
reachable:

```
pnpm supabase status --output env
```

## Verify

```
pnpm format && pnpm lint && pnpm typecheck
pnpm test test/migration-grants.test.ts test/migration-baseline.test.ts test/rls-policy-correlation.test.ts
```

Full suite green; coverage thresholds not lowered.

Manual gate against the live stack (the function only has teeth under a real
user JWT, so the smoke runs through the browser, not the service client):

1. `pnpm dev`, log in as a seeded user.
2. Send an email change for that user and read the mailed link from Mailpit
   (`http://127.0.0.1:54324`). The link target is
   `.../api/auth/callback?code=...`.
3. In the browser console, call the helper through the session-bearing client:

   ```js
   await supabase.rpc("cancel_pending_email_change");
   ```

   (Or, if the console has no `supabase` handle, invoke the route added in
   sheet 02 once it exists.)

4. Confirm `auth.one_time_tokens` holds no `email_change_token_new` row for
   the user and `auth.users.email_change` is back to its clean `''` value.
5. Click the mailed link: the browser lands on `/email-link-expired` (GoTrue
   answers `otp_expired`), never on a sign-in failure.

## Commit

```
feat(auth): cancel voids a pending email change at the source

Body: a plain cancel only dismissed the client's sent state, leaving GoTrue
holding auth.users.email_change and a live email_change_token_new row, so the
mailed link stayed usable for 24h. A SECURITY DEFINER helper deletes the
token and clears the pending fields for the caller, making the link fail as
otp_expired and keeping a reload from resurrecting the banner. Same seam as
qa_message_visible; idempotent and scoped by auth.uid().
```

## Definition of done

- `public.cancel_pending_email_change()` exists, is `SECURITY DEFINER`, scoped
  by `auth.uid()`, and granted to `authenticated` (not `anon` or `service_role`).
- A pending email-change link, once canceled, lands on `/email-link-expired`
  instead of completing the change.
- The migration-grants test's exact list includes `00006_...`.
