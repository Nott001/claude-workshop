# SPEC-09 — Shell module & shared layering

## Scope

Create `src/modules/shell/` to own the app chrome (`app-shell`, `navbar`,
`floating-assist-button`, `footer`, `error-boundary`), move it out of
`src/shared/components`, and pin the rule that shared never imports modules.
No behavior change.

## Background

`src/shared/components/app-shell.tsx:4,6` imports `@/modules/auth/...session-context`
and `@/modules/support/...floating-assist-button`; `navbar.tsx:6` imports auth. That
inverts the layering — "shared" now depends on modules, and any shared component
gaining a `useSession` dependency would close a hard cycle. The chrome is
app-wide layout, not a shared primitive; it belongs in its own module.

## Changes

- New `src/modules/shell/`:
  - `components/app-shell.tsx` (moved from `src/shared/components/`)
  - `components/navbar.tsx` (moved)
  - `components/footer.tsx` (moved)
  - `components/error-boundary.tsx` (moved)
  - `components/floating-assist-button.tsx` (moved from
    `src/modules/support/components/`) — stays a shell-owned chrome element; the
    support module imports it from shell if it still needs it, or shell imports
    the support panel — see note below.
- The support "assist" feature is wedged into the chrome today. Move the assist
  panel/button together so the chrome is self-contained; if the assist widget is
  genuinely support-domain, keep `floating-assist-button` as a thin shell shell that
  renders `@/modules/support`'s panel — the direction is shell → support, not the
  reverse.
- `src/shared/components/` keeps only presentational primitives (`button.tsx`,
  `input.tsx`, `label.tsx`, `textarea.tsx`, `multi-select.tsx`, `status-badge.tsx`,
  `toast.tsx`, `dropdown-menu.tsx`, `avatar.tsx`, `card.tsx`) plus shared lib
  (`utils.ts`, `date-utils.ts`, `fetcher.ts`, `roles.ts`, `role-hierarchy.ts`,
  `event-format.ts`).
- Update all import sites of the moved components across `src/app` and
  `src/modules/*` (`@/shared/components/app-shell` → `@/modules/shell/components/app-shell`, etc.).
- `test/shared-boundary.test.ts` (new, mirrors `test/module-boundary.test.ts`):
  no file under `src/shared` imports `@/modules/*`. This test pins the layer so the
  inversion cannot return.

## Non-goals

- No changes to the chrome's rendered output.
- No restructuring of shared primitives; `multi-select.tsx` is still events-only
  (a move candidate for later, not here).
- No auth behavior changes (SPEC-08 owns those).

## Files touched

- `src/modules/shell/components/*` (5 moved files)
- `src/shared/components/{app-shell,navbar,footer,error-boundary}.tsx` (deleted)
- `src/modules/support/components/floating-assist-button.tsx` (moved to shell)
- Import sites in `src/app/**` and `src/modules/**`
- `test/shared-boundary.test.ts` (new)

## Verification

- `pnpm test` — new `shared-boundary` test passes.
- `rg 'from "@/shared/components/(app-shell|navbar|footer|error-boundary)"' src` returns nothing.
