# 01 — DAO deletion primitives for account teardown

## Purpose

Account deletion removes a user's personal data from seven tables. Four of
those already have teardown helpers (support), the rest have none — and four
of the columns involved are either keyed by a raw email string or sit behind
FKs with no `ON DELETE` action. This sheet adds one deletion function per
table, all on the service-role data layer, so the orchestrating service (sheet 02) composes them instead of scattering `.delete()` chains. **No schema change
is involved**, so no migration is added and the six-file chain pinned by
`test/migration-grants.test.ts:36-43` stays untouched.

## Background (current code)

All writers run through `getServiceClient()` (`src/shared/db/client.ts:18-33`)
— the `service_role` client, which has `GRANT ALL` on every table in play
(`supabase/migrations/00001_initial_schema.sql:1371-1467`) and bypasses RLS,
so these deletes need no grants or policies.

Already present (no work, cited for the service in sheet 02):

- `chat-message.dao.deleteMessagesByUser` / `deleteMessagesByRecipient`
  (`src/shared/db/dao/chat-message.dao.ts:97-105`) — hard `DELETE` on
  `user_id` / `recipient_user_id`. Re-exported through
  `src/shared/db/dao/chat.dao.ts`.
- `support-session.dao.deleteSession` (`src/shared/db/dao/support-session.dao.ts:162-165`)
  and `endSession` (`:118-143`).

Missing — one new function per table:

| Table                    | Filter column | File                                          | Notes                                                                                                                                                                                                         |
| ------------------------ | ------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TICKET`                 | `user_id`     | `src/shared/db/dao/ticket.dao.ts`             | FK `TICKET_user_id_fkey` is `ON DELETE SET NULL` (00001:1217-1218); rows must be deleted explicitly                                                                                                           |
| `QA_MESSAGE`             | `user_id`     | `src/modules/courses/qa/db/qa-message.dao.ts` | Only `softDelete` exists today (`:67-71`); event-completion cleanup hard-deletes by event via trigger `delete_qa_on_event_complete` (00001:207-217), but persisted rows for this user need a hard delete here |
| `SURVEY_RESPONSE`        | `user_id`     | `src/modules/surveys/db/survey.dao.ts`        | FK `SURVEY_RESPONSE_user_id_fkey` has **no `ON DELETE` action** (00001:1187-1188) — a hard `DELETE FROM USER` would be blocked; not deleting USER makes the guard unnecessary, but the rows still go          |
| `EMAIL_LOG`              | `user_id`     | `src/shared/db/dao/email.dao.ts`              | `EMAIL_LOG_user_id_fkey` is `ON DELETE SET NULL` (00001:1067-1068); rows removed here so no log outlives the account                                                                                          |
| `PASSWORD_RESET_ATTEMPT` | `email`       | `src/shared/db/dao/password-reset.dao.ts`     | No FK to USER — keyed by the email string (00001:482-487), written in `recordAttempt` (`:8-13`). Needs the original email, which sheet 02 captures before anonymizing                                         |
| `SPEAKER_PROFILE`        | `user_id`     | `src/shared/db/dao/speaker.dao.ts`            | `SPEAKER_PROFILE_user_id_fkey` cascades (00001:1152-1153) → cascades `EVENT_SPEAKER` (00001:1092-1093) and nulls `MODULE.speaker_profile_id` (00001:1122-1123)                                                |

No `service_role` grant work: every table already grants `ALL` to
`service_role` in the baseline migration.

## Scope

Six new DAO functions (one per table above), each a single `DELETE` narrowed
by one column, returning `boolean` (`!error`) like the neighboring helpers.
DAO tests for each. No route, service, schema, or client code changes.

## Steps

### 1. `ticket.dao.deleteByUser`

Append to `src/shared/db/dao/ticket.dao.ts`, after `deleteByPaymentIds`
(`:246-249`):

```ts
export async function deleteByUser(supabase: DbClient, userId: number): Promise<boolean> {
  const { error } = await supabase.from("TICKET").delete().eq("user_id", userId);
  return !error;
}
```

### 2. `qa-message.dao.deleteByUser`

Append to `src/modules/courses/qa/db/qa-message.dao.ts`, after `softDelete`
(`:67-71`):

```ts
export async function deleteByUser(supabase: DbClient, userId: number): Promise<boolean> {
  const { error } = await supabase.from("QA_MESSAGE").delete().eq("user_id", userId);
  return !error;
}
```

### 3. `survey.dao.deleteResponsesByUser`

Append to `src/modules/surveys/db/survey.dao.ts`:

```ts
export async function deleteResponsesByUser(supabase: DbClient, userId: number): Promise<boolean> {
  const { error } = await supabase.from("SURVEY_RESPONSE").delete().eq("user_id", userId);
  return !error;
}
```

### 4. `email.dao.deleteByUser`

Append to `src/shared/db/dao/email.dao.ts`, after `insert` (`:73-88`):

```ts
export async function deleteByUser(supabase: DbClient, userId: number): Promise<boolean> {
  const { error } = await supabase.from("EMAIL_LOG").delete().eq("user_id", userId);
  return !error;
}
```

### 5. `password-reset.dao.deleteByEmail`

Append to `src/shared/db/dao/password-reset.dao.ts`. Takes the raw address,
not a user id — the table is keyed by email:

```ts
export async function deleteByEmail(supabase: DbClient, email: string): Promise<boolean> {
  const { error } = await supabase.from("PASSWORD_RESET_ATTEMPT").delete().eq("email", email);
  return !error;
}
```

### 6. `speaker.dao.removeByUserId`

Append to `src/shared/db/dao/speaker.dao.ts`, after `remove` (`:104-107`),
which is keyed by profile id:

```ts
export async function removeByUserId(supabase: DbClient, userId: number): Promise<boolean> {
  const { error } = await supabase.from("SPEAKER_PROFILE").delete().eq("user_id", userId);
  return !error;
}
```

### 7. DAO tests

New file `test/account-teardown-dao.test.ts`, using the recorded-builder stub
pattern from `test/chat-message-dao.test.ts:6-25` (a chain that records
`[method, args]` per call). For each function:

- the emitted call is `delete` on the expected table with the expected
  equality filter (e.g. `argsOf(calls, "eq")` equals `["user_id", userId]`);
- the returns `false` when the query reports an error, `true` otherwise —
  assert on behavior, not shape, by stubbing `{ error }` / `{}` and checking
  the boolean.

## Verify

```
pnpm format && pnpm lint && pnpm typecheck
pnpm test
```

Full suite green; coverage thresholds not lowered (AGENTS.md).

## Commit

```
feat(dao): add per-table deletion primitives for account teardown

Body: account deletion removes a user's rows from seven tables, but only the
support DAOs had teardown helpers and four tables sat behind FKs with no ON
DELETE action or plain string keys. Add one delete-per-table on the service
layer so the deletion orchestrator composes named functions instead of
scattering .delete chains. No schema change, so no migration.
```

## Definition of done

- `deleteByUser` exists on `ticket.dao`, `email.dao` and `qa-message.dao`;
  `deleteResponsesByUser` on `survey.dao`; `deleteByEmail` on
  `password-reset.dao`; `removeByUserId` on `speaker.dao`.
- Each is a single-column `DELETE` returning `!error`, using the service-role
  client with no grant or RLS changes.
- `test/account-teardown-dao.test.ts` covers every new function; suite green.
