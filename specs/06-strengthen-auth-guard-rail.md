# 06 — Enforce the unified guard idiom with a route sweep

## Run order

Sixth. Requires sheets 03–05 — this gate fails until every literal refusal is gone.

## Motivation

Sheets 03–05 migrated the routes; nothing yet stops the dual pattern from
returning. `test/guard-failure.test.ts` already sweeps every `route.ts` for the
old drift (`guard.error` next to a hard-coded status); extend the same sweep to
the inline form that predates the unification:

```ts
return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
// or
return NextResponse.json({ error: "Forbidden" }, { status: 403 });
```

A new route or a regression must not be able to smuggle a hand-rolled guard
refusal past the guard rail.

## Scope

- `test/guard-failure.test.ts`

## Changes

In the `describe("route guard refusals go through the helper")` block, add a
second `it` alongside the existing `guard.error` sweep:

```ts
// The pre-unification form lived on `requireAuth` + a bare null check, so it
// had no `guard.error` to pair a status with. Sheets 03-05 moved every such
// handler onto requireRole()/requireMinRole() + guardFailure; this keeps the
// inline NextResponse.json refusal from coming back.
it("no route hand-rolls a guard refusal outside the helpers", () => {
  const offenders = files.filter((f) =>
    // `\s*` lets prettier wrap the call across lines without silently evading
    // the sweep — the single-line form is the common one today.
    /NextResponse\.json\(\s*\{ error: "(?:Unauthenticated|Forbidden)" \}\s*,\s*\{ status: (?:401|403) \}\s*\)/.test(
      readFileSync(f, "utf8"),
    ),
  );

  expect(offenders.map((f) => path.relative(API_DIR, f))).toEqual([]);
});
```

Notes:

- The regex targets the exact guard bodies. Custom-message domain 403s
  (`"Not a speaker"`, `"Only assigned staff can update the live highlight"`,
  `"You cannot invite a role you do not outrank"`) and the different-envelope
  auth-mail responses (`{ ok: false, error: { status, message } }`) do **not**
  match, so they stay legal.
- `guardFailure`/`forbidden` live in `src/modules/auth/lib/`, outside `API_DIR`,
  so the sweep never flags the helpers themselves.
- Keep the existing `guard.error` sweep as-is; it guards the older form.

## Acceptance

- Run the sweep: it must pass with zero offenders.
- `test/api-auth-coverage.test.ts` unchanged and green (its
  `requireAuth|requireMinRole|requireRole` regex still matches every routed file).

## Verification

```sh
pnpm format && pnpm lint && pnpm typecheck && pnpm test
```

## Commit

```
test: sweep routes for hand-rolled guard refusals

Sheets 03-05 unified every route onto guardFailure/forbidden(); the load-bearing
test is the one that keeps a regression — an inline status next to an
"Unauthenticated"/"Forbidden" body — from reintroducing the dual pattern.
```

No CHANGELOG entry (internal test).
