# 11. Migrate the organization members table

## Goal

The organization page composes the shared primitives, gains server-side search
and a role filter plus pagination (the API from sheet 07 supports all three),
and moves the per-row Remove action into a drawer. The Invite member dialog is
untouched.

## Run order

Eleventh. Depends on sheets 01–03 and 07.

## Files touched

- `src/app/staff/organization/page.tsx`
- Tests: `test/staff-organization-invite-toast.test.tsx`; add
  `test/organization-page.test.tsx`

## Prerequisites

- Sheets 01–10 complete and verified. `/api/organization` accepts
  `search`, `role`, `page` (sheet 07).

## Steps

1. **State** — add `search`, `roleFilter` (`"all" | UserRole`), `page`; drop
   the fixed `?pageSize=50` in favour of `?page=&limit=15&search=&role=` with
   `pageSize = 15`. Keep `refreshKey`; the fetch effect depends on
   `[page, search, roleFilter, refreshKey]` (search is debounced via
   `useDebouncedValue`, which keeps the request count sane while still being
   server-side).
2. **Header** — keep the title and Invite member button; below it render
   `TableSearch` and `FilterTabs` for the role (All, Facilitator, Speaker,
   Admin, Super Admin — admin/super_admin only see invitable roles for the
   picker, but the filter can show every role present).
3. **Table** — swap the hand-rolled `<table>` for the shared primitives
   (columns: Name, Email, Role, trailing chevron). Role cell keeps `Badge`.
   `TableRow` onClick opens the drawer; below the table render `Pagination`
   with the API's `total`.
4. **Drawer** — `selected: Member | null`; body shows name, email, role
   badge; footer shows **Remove** only when `isAdmin && m.id !== user?.id`,
   wired to the existing `handleRemove` (its `confirm()` stays). No Remove
   button remains in the table body.
5. **Tests**
   - `test/organization-page.test.tsx`: renders members; typing search drives
     `search=` after the debounce; role tab drives `role=`; pagination drives
     `page=`; clicking a row opens the drawer; Remove from the drawer calls
     `DELETE /api/organization/{id}` and the row leaves after refresh.
   - `test/staff-organization-invite-toast.test.tsx`: the invite flow
     unchanged, but re-stub the fetch — the members fetch now sends
     `page`/`limit`. Keep the toast assertions intact.
6. Raise `vitest.config.ts` thresholds by whatever these tests add.

## Verification

- `pnpm typecheck` passes.
- `pnpm test` passes with coverage at or above the pre-sheet thresholds.
- `pnpm lint` and `pnpm format` pass.
- `rg "Remove" src/app/staff/organization/page.tsx` finds it only inside the
  drawer.
- Manually in `pnpm dev` (admin): search, filter by role, page, and remove a
  member from the drawer.

## Risks

- The page fetches under `useRoleGuard(ROLES.ADMIN)`; guard gating stays first
  so the fetch effect does not run for the wrong role.
- `roleFilter` values must be validated before interpolation — the sheet 07
  route already whitelists them; the page only sends one of its own tab keys.
