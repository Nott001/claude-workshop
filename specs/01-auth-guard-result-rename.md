# 01 — Rename `RoleGuardResult` to `AuthGuardResult`

## Run order

First. Requires nothing. Run before sheets 03–05, which move routes onto the renamed type's APIs.

## Motivation

The result type is not role-only. `requireRole()` with an empty list guards "any
authenticated caller", and the type carries the full `AuthUser`, not a role.
The unification sheets ahead make `requireRole()` the auth-only primitive, so
the name keeps overstating the coupling. The rename is cheap today because the
type is referenced in only three files — do it before the route sweep multiplies
the references.

## Scope

Only these files (verified: `rg -l "RoleGuardResult" src test` returns exactly them):

- `src/modules/auth/lib/types.ts` — definition
- `src/modules/auth/lib/role-guard.ts` — import + two return annotations
- `src/modules/auth/lib/guard-response.ts` — import + one parameter type

No test file imports the type; `test/role-guard.test.ts` and
`test/guard-failure.test.ts` assert result shapes via object literals.

## Changes

1. In `src/modules/auth/lib/types.ts`, rename `RoleGuardResult` → `AuthGuardResult`.
2. In `src/modules/auth/lib/role-guard.ts`, update the import and the two
   `Promise<RoleGuardResult>` annotations.
3. In `src/modules/auth/lib/guard-response.ts`, update the import and the
   `guardFailure` parameter type.
4. While touching `role-guard.ts`, drop the two dead casts `user.role as UserRole`
   (lines 17 and 32). `AuthUser["role"]` is already `UserRole`
   (`AuthUser = Pick<User, ...>` and `User.role: UserRole` in `src/shared/types.ts`),
   so the casts assert nothing `typecheck` does not already prove. Removing them
   makes `hasMinRole(user.role, role)` a real typecheck rather than an unchecked
   assertion.

## Tests

No edits expected. Run the full gates.

## Acceptance

- `rg -c "RoleGuardResult" src test` → 0 matches.
- `rg -c "as UserRole" src/modules/auth/lib/role-guard.ts` → 0 matches.
- `pnpm typecheck` green.

## Verification

```sh
pnpm format && pnpm lint && pnpm typecheck && pnpm test
```

## Commit

```
refactor: rename RoleGuardResult to AuthGuardResult

The type guards authentication plus optional role membership — requireRole()
with no args is the auth-only guard — so the name overstated the role
coupling. It was cheapest to correct while confined to three files, ahead of
the route sweep that moves auth-only handlers onto it.
```

No CHANGELOG entry (internal rename).
