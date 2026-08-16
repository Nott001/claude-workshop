# 02 — Delete-account service orchestration

## Purpose

Sheet 01 added the row-deletion primitives. This sheet lays down the one
server function that runs them in a safe order and performs the two
irreversible steps: anonymizing the app `USER` row and deleting the Supabase
auth identity. The API route (sheet 03) only calls this function; no other
code ever deletes a whole account.

## Background (current code)

- The app maps `USER.auth_user_id` → `auth.users.id` 1:1 (00001:913); the
  browser session is the Supabase cookie session guarded by `requireAuth()`
  (`src/modules/auth/lib/session.ts:32-51`), which returns an `AuthUser`
  projection with `id`, `role`, `full_name`, `email`, `profile_image_url` —
  **not** the auth UUID. The orchestrator needs both the numeric `USER.id`
  and the auth UUID (for `admin.deleteUser`), so the route passes both
  (sheet 03).
- `endCase` (`src/modules/chat/lib/support-service.ts:164-191`) ends a user's
  active session. Its own-account branch calls `endSession` directly and
  tolerates the no-active-session case (returns null), so it is safe to call
  on an account with no open case. It writes the `[Chat ended]` notice row,
  which is removed by the message purge that follows.
- `chat-message.dao.deleteMessagesByUser` / `deleteMessagesByRecipient`
  (`src/shared/db/dao/chat-message.dao.ts:97-105`) hard-delete chat rows on
  the `user_id` and `recipient_user_id` columns — the FK-pull leak the plain
  `USER`-delete cascade would leave. Same teardown used by
  `DELETE /api/support/sessions/[userId]` (`src/app/api/support/sessions/[userId]/route.ts:17-21`).
- Storage cleanup precedent: `DELETE /api/upload/profile-image`
  (`src/app/api/upload/profile-image/route.ts:78-92`) lists
  `profile_images/users/{id}` with `listStorageFolder` and removes it with
  `deleteFromStorage` (`src/shared/integrations/storage/service.ts:28-48`,
  no-throw by design).
- `userDao.updateUser` (`src/shared/db/dao/user.dao.ts:86-105`) writes
  `full_name`, `email` and `profile_image_url` on the auth UUID and returns
  the row or `null`. `USER.email` is UNIQUE (00001:918), so the tombstone
  email must be a unique placeholder per id.
- `supabase.auth.admin.deleteUser(authUserId)` is the established identity
  deletion pattern (`src/modules/auth/lib/organization-service.ts:41`, with
  error handling at `:46-48`).
- Payments (kept) resolve the buyer's email by joining `PAYMENT.user_id` →
  `USER` (e.g. `payment.dao.findByGatewayReference` uses
  `USER:user_id(full_name, email)`). Anonymizing the row in place is what
  makes those records display the deleted placeholder instead of the address.

## Scope

A single server module `src/modules/user/lib/delete-account.ts` exporting
`deleteAccount()`, plus unit tests. No route, DAO, schema or client changes.

## Steps

### 1. Create the module

New file `src/modules/user/lib/delete-account.ts` (server-only, **no**
`"use client"`). Public signature:

```ts
export interface DeleteAccountInput {
  userId: number; // USER.id (numeric app row)
  authUserId: string; // auth.users.id (from getCurrentUserId)
  email: string; // the live address, needed before it is anonymized
  role: UserRole; // passed through to endCase's actor
}

export async function deleteAccount(input: DeleteAccountInput): Promise<void>;
```

### 2. Orchestrate, in this order

Run on `getServiceClient()`. Steps 1–7 purge rows and **fail loudly** (throw
on a `false` return) so a partial purge aborts **before** the point of no
return; step 8 (storage) follows the established no-throw convention; step 9
is irreversible and fails loudly too.

1. **Support**: `endCase(supabase, userId, { id: userId, role })` — best
   effort (inert when there is no active case; the written notice is removed
   by the next step). Then
   `chatDao.deleteMessagesByUser(supabase, userId)` and
   `chatDao.deleteMessagesByRecipient(supabase, userId)`.
2. `ticketDao.deleteByUser(supabase, userId)`.
3. `qaMessageDao.deleteByUser(supabase, userId)` — hard delete, so rows that
   lingered past the event-completion cleanup are gone for good.
4. `surveyDao.deleteResponsesByUser(supabase, userId)`.
5. `emailDao.deleteByUser(supabase, userId)`.
6. `passwordResetDao.deleteByEmail(supabase, input.email)` — the raw address
   is read from `input`, which is why it must survive until here.
7. `speakerDao.removeByUserId(supabase, userId)` — unconditionally; harmless
   when the user is not a speaker. Cascades `EVENT_SPEAKER`, nulls
   `MODULE.speaker_profile_id`.
8. **Storage** (best-effort, no-throw): `listStorageFolder("profile_images",
\`users/${userId}\`)`→`deleteFromStorage("profile_images", paths)`.
9. **Anonymize the app row**:
   `userDao.updateUser(supabase, authUserId, { full_name: "Deleted User",
email: \`deleted-${userId}@deleted.local\`, profile_image_url: null })`.
If it returns `null`, throw — the row must be in its final state before
   the identity leaves.
10. **Delete the auth identity**:
    `supabase.auth.admin.deleteUser(authUserId)`; on error, throw.
    This is what ends the account for good and guarantees the tombstone can
    never sign in.

Keep each failure message distinct so a retry (deletes are idempotent) is
unambiguous. Wrap shared error detail in the thrown error's message; the route
decides the HTTP status. `role` stays unchanged on the tombstone — the row is
inert once the identity is gone, and resetting it buys nothing.

### 3. Tests

New file `test/delete-account.test.ts`. Mock the DAO modules and the client
with the `vi.hoisted` pattern from `test/api-auth-me.test.ts:6-18`, and stub
the support/chat DAOs through `@/shared/db/dao/chat.dao`. Assert on behavior:

- every purge among steps 1–7 is called with the right id/email;
- storage listing/removal is best-effort: when `listStorageFolder` resolves
  to paths, `deleteFromStorage` is called with them; the service still
  succeeds when either throws;
- a `false` return from any DAO purge throws and **aborts before**
  anonymize/auth-delete (assert those are not called);
- anonymize writes `{ full_name: "Deleted User", email:
"deleted-<id>@deleted.local", profile_image_url: null }` via
  `userDao.updateUser`, and a `null` return throws;
- `auth.admin.deleteUser` receives the auth UUID; an error from it throws.

## Verify

```
pnpm format && pnpm lint && pnpm typecheck
pnpm test
```

Full suite green; coverage thresholds not lowered.

## Commit

```
feat(user): orchestrate account deletion behind one service function

Body: deletion spans eight data stores and two irreversible steps, so wiring
it into the route would scatter .delete chains and risk removing PII after
the identity is already gone. One service function purges the rows first
(aborting before the point of no return on any failure), best-efforts the
profile-image folder, then anonymizes the USER row and deletes the auth
identity. The anonymized tombstone keeps payments' email join resolving to a
deleted placeholder, satisfying the keep-payments requirement with no schema
change.
```

## Definition of done

- `src/modules/user/lib/delete-account.ts` exists; `deleteAccount()` purges
  support chat, tickets, QA messages, survey responses, email logs,
  password-reset attempts and the speaker profile, then anonymizes the USER
  row and calls `auth.admin.deleteUser`.
- A failed purge aborts before anonymize/auth-delete; storage failure never
  aborts.
- `test/delete-account.test.ts` covers every step; suite green.
