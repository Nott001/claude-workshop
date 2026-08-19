# 02 — Add `forbidden()` for entitlement denials

## Run order

Second. Requires sheet 01 (it shares `guard-response.ts`). Required by sheets 04–05.

## Motivation

`guardFailure` centralises the two guard refusals — 401 for unauthenticated,
403 for authorised-but-not-permitted. But not every 403 is a role refusal:
ownership checks, event-scoped access and resource predicates (e.g.
`courses/[courseId]/room`'s ticket-or-staff gate) are domain logic that cannot
be expressed as a `requireMinRole`/`requireRole` call. Those sites still
hand-roll `NextResponse.json({ error: "Forbidden" }, { status: 403 })`,
re-introducing the duplication the guards eliminate. `forbidden()` gives them
the same single source of truth without dragging session or database imports
into the module.

## Scope

- `src/modules/auth/lib/guard-response.ts`
- `test/guard-failure.test.ts`

## Changes

1. In `src/modules/auth/lib/guard-response.ts`, add:

```ts
// Entitlement denials that a role guard cannot express (ownership, event
// scope) answer the same 403 body a role refusal renders, so the client sees
// one "Forbidden".
export function forbidden(): NextResponse {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

2. Extend the module's doc comment so it documents both helpers: `guardFailure`
   renders a refused guard, `forbidden` renders a denial a guard cannot state.
   Keep the note about staying free of session/database imports.

## Tests

Add a `describe("forbidden")` block to `test/guard-failure.test.ts`:

- `status === 403`.
- Body is `{ error: "Forbidden" }`.
- Body is never paired with a `401` status.

## Acceptance

- `forbidden` is exported but not yet imported anywhere (sheets 04–05 add the
  call sites) — that is expected for this sheet.
- `pnpm test` green.

## Verification

```sh
pnpm format && pnpm lint && pnpm typecheck && pnpm test
```

## Commit

```
feat: answer entitlement denials through forbidden()

Ownership and event-scope refusals render the same 403 "Forbidden" body a
guard refusal answers; sheets 03-05 rewrite their call sites onto it so the
client sees one shape for every 403.
```

No CHANGELOG entry (no wire behaviour changes yet).
