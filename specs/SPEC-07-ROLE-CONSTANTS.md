# SPEC-07 — Typed role constants

## Scope

Replace the ~77 files that hardcode role strings (`"attendee"`, `"speaker"`,
`"facilitator"`, `"admin"`, `"super_admin"`) with a single typed constant set,
and delete the duplicated role list in the organization page. Mechanical sweep —
no behavior change.

## Background

Role literals are scattered as magic strings across modules, the app tree, and
even DAO query filters (`user.dao.ts:28`, `facilitator.dao.ts:20,57`,
`speaker.dao.ts:39,116`, `event.dao.ts:55,66`, `chat-message.dao.ts:168`). The
only constant that exists (`INVITABLE_ROLES` in
`src/modules/auth/lib/invited-role.ts:4`) is consumed by exactly one route, and
`src/app/staff/organization/page.tsx:29` re-declares its own copy. `ROLE_LEVEL` in
`src/shared/lib/role-hierarchy.ts` already models the role set privately.

## Changes

- New `src/shared/lib/roles.ts` exporting:
  - `ROLES` — `{ ATTENDEE, SPEAKER, FACILITATOR, ADMIN, SUPER_ADMIN }` as const
  - `ALL_ROLES: readonly UserRole[]` — the canonical list for any all-role set
  - `INVITABLE_ROLES` + `InvitableRole` (moved from `invited-role.ts`; re-exported
    there so the one existing import keeps working)
- Sweep the hardcoded literals in `src/**`:
  - app-tree pages, layouts, and guards (`middleware.ts`, `navbar.tsx`,
    `app-shell.tsx`, `staff/organization/page.tsx`, `events/page.tsx`,
    `events/[id]/page.tsx`, kiosk pages)
  - API routes (`requireRole(...)` and `hasMinRole(...)` call sites)
  - module hooks and components (`use-event-list.ts`, `fetch-event-access.ts`,
    `qa-panel.tsx`, `chat-panel.tsx`, `use-support-cases.ts`, etc.)
  - DAO query filters listed above (keep the literal in the SQL string, source it
    from the constant)
- Replace `staff/organization/page.tsx`'s local `INVITE_ROLES` with the imported
  constant.
- `src/modules/auth/lib/role-hierarchy.ts` `ROLE_LEVEL` may import `ROLES` to
  remove the `as const` duplication, or stay as-is — pick whichever keeps the diff
  smallest.

## Non-goals

- No change to `requireRole`/`hasMinRole` semantics — that is SPEC-08.
- No new roles; no schema/type changes to `src/shared/types.ts`.

## Files touched

- `src/shared/lib/roles.ts` (new)
- `src/modules/auth/lib/invited-role.ts` (re-export the moved constant)
- ~77 files across `src/app`, `src/modules/*`, `src/shared/db/dao/*` (literal → constant)

## Verification

- `pnpm typecheck` passes.
- `rg '"attendee"|"speaker"|"facilitator"|"admin"|"super_admin"' src` returns only
  `src/shared/lib/roles.ts`, `src/shared/types.ts`, and SQL/migration files.
- `pnpm test` green.
