# 07 — Unify service error mapping and normalise the error body

## Run order

Seventh and last. Requires sheets 03–05 (they touch the same route files). This
is the **breaking-change** sheet: it changes response **bodies**.

## Motivation

Every route that calls a domain service carries its own `mapError`:

```ts
function mapError(err: unknown): NextResponse {
  if (err instanceof EventServiceError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  throw err;
}
```

There are 20 of these, plus inline `if (err instanceof XServiceError)` blocks in
five more, against **seven near-identical error classes** that differ only in
name (split by module-boundary discipline). And the body shape drifted: most
routes answer flat `{ error: "…" }`, but `community/*`, `organization/*`,
`events` (collection), `events/[id]` (400/500) and `modules/[id]` (400) answer
nested `{ error: { message } }`, and three flatten differently per status. One
`ServiceError` base + one `toErrorResponse` helper kills the duplication, and a
single flat body answers every domain failure exactly like the auth refusals do.

## Changes

### 1. Shared base — new `src/shared/lib/service-error.ts`

```ts
export class ServiceError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
```

### 2. Domain error classes become thin subclasses

All take `(status, message)` (verified), so no subclass constructor is needed;
`new.target.name` keeps each class's own name for `instanceof` and tests.

| File                                               | Class                                           |
| -------------------------------------------------- | ----------------------------------------------- |
| `src/modules/events/lib/event-errors.ts`           | `EventServiceError extends ServiceError`        |
| `src/modules/community/lib/community-errors.ts`    | `CommunityServiceError extends ServiceError`    |
| `src/modules/courses/lib/course-errors.ts`         | `CourseServiceError extends ServiceError`       |
| `src/modules/courses/lib/course-module-service.ts` | `CourseModuleServiceError extends ServiceError` |
| `src/modules/courses/qa/lib/service.ts`            | `QaServiceError extends ServiceError`           |
| `src/modules/chat/lib/support-service.ts`          | `SupportServiceError extends ServiceError`      |
| `src/modules/auth/lib/organization-service.ts`     | `OrganizationServiceError extends ServiceError` |

Each keeps its own file (module boundaries intact). Trim the now-redundant doc
comments that recite the `(status, message)` contract — the base owns it.

### 3. Shared renderer — new `src/shared/lib/error-response.ts`

```ts
import { NextResponse } from "next/server";
import { ServiceError } from "./service-error";

export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof ServiceError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  throw err;
}
```

Same purity policy as `guardFailure`: free of session/database imports.

### 4. Route sweep — delete every `mapError`

For all 20 files with a `function mapError` **and** the 5 inline
`if (err instanceof XServiceError)` blocks:

1. Import `toErrorResponse` from `@/shared/lib/error-response`.
2. Delete the local `mapError` function.
3. `return mapError(err);` → `return toErrorResponse(err);`
4. Inline blocks → the catch becomes `catch (err) { return toErrorResponse(err); }`.

Files with `mapError`: `community/route.ts`, `community/[id]/route.ts`,
`organization/route.ts`, `organization/[userId]/route.ts`, `events/route.ts`,
`events/[id]/route.ts`, `events/[id]/register/route.ts`,
`events/[id]/publish/route.ts`, `events/[id]/attendees/route.ts`,
`events/[id]/attendees/manage/route.ts`,
`events/[id]/attendees/[userId]/{cancel,checkin,resend-ticket,survey}/route.ts`,
`support/route.ts`, `support/sessions/route.ts`, `qa/message/[messageId]/route.ts`,
`qa/module/[moduleId]/route.ts`, `modules/[id]/route.ts`,
`courses/[courseId]/live/highlight/route.ts`.

Inline blocks: `events/[id]/meeting-link/route.ts`, `events/[id]/survey/route.ts`,
`events/[id]/survey/send/route.ts`, `events/[id]/speakers/route.ts`,
`events/[id]/speakers/[profileId]/route.ts`.

The resulting body is flat `{ error: <message> }` everywhere. This **normalises
the wire shape** — the nested `{ error: { message } }` variants and the
status-dependent flat/nested splits in `community/*`, `organization/*`,
`events/route.ts`, `events/[id]/route.ts` (its 400/500 branch) and
`modules/[id]/route.ts` (its 400 branch) disappear.

### 5. Client call sites that read the nested body

Add a helper that reads both shapes, so nothing breaks if a pre-deploy client
hits the new flat bodies during the transition:

```ts
// new src/shared/lib/api-error-message.ts
export function apiErrorMessage(body: unknown, fallback: string): string {
  const error = (body as { error?: string | { message?: string } } | null)?.error;
  if (typeof error === "string") return error;
  return error?.message ?? fallback;
}
```

Update the nested readers to it:

- `src/app/staff/organization/page.tsx` — `data?.error?.message` (3 sites: invite, role change, removal).
- `src/modules/events/components/event-team-panel.tsx` — `body?.error?.message`.
- `src/modules/events/components/event-survey-panel.tsx` — `body?.error?.message`.
- `src/modules/events/components/edit-event-form.tsx` — `body?.error?.message`.
- `src/modules/events/components/meeting-link-panel.tsx` — currently branches
  `typeof body?.error === "string"` vs `.message`; simplify to `apiErrorMessage`.

### Exempt (different envelopes, no `ServiceError`)

- `src/app/api/auth/email/send/route.ts`, `auth/email/cancel/route.ts` —
  `{ ok: false, error: { status, message, retryAfter } }`, client contract of
  its own; leave.
- `src/app/api/payments/webhook/route.ts` — HMAC/signature handling; leave.
- `checkin/route.ts`, `checkin/lookup/route.ts` — sheet 05 already replaced
  their 403 flatten with `forbidden()`; the remaining `throw err` is untouched.

## Tests

- `rg -n 'error: \{ message' test` — update every response-body assertion that
  expects the nested shape to the flat `{ error: "…" }`.
- Route tests that mock a service throwing `XServiceError` stay valid: `instanceof`
  holds because the subclasses exist; assertions on `err.status`/body now read flat.
- Add a unit test for `toErrorResponse` (rethrow of non-`ServiceError`, flat body
  - status passthrough) and one for `apiErrorMessage`.

## Acceptance

- `rg -n "function mapError" src/app/api --glob "route.ts"` → 0.
- `rg -n 'error: \{ message' src` → 0 (only the `apiErrorMessage` helper's type
  remains, and `auth/email/*`'s unrelated envelope).
- Every vulnerable client call site uses `apiErrorMessage`.
- Coverage thresholds raised, never lowered.

## Verification

```sh
pnpm format && pnpm lint && pnpm typecheck && pnpm test
```

## Commit

```
refactor: render every domain error through one ServiceError helper

Seven near-identical error classes and twenty route-local mapError copies
answered a response body that had drifted into three shapes. A single shared
ServiceError base and toErrorResponse() keep the module boundaries that
created the copies, and normalise every domain failure onto the flat
{ error } body the auth guards already serve.
```

CHANGELOG: add under the breaking/changed heading — the API error body for
`community/*`, `organization/*`, `events`, `events/[id]`, `modules/[id]` changes
from `{ error: { message } }` to `{ error: "…" }`; the client was updated to
tolerate both while it rolls.
