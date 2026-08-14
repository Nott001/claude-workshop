# 09. Migrate the admin attendee management table

## Goal

The admin attendee table (event → Attendees tab) composes the shared
primitives and moves its four in-cell actions — Check in, Send survey, Resend
ticket, Cancel — into a per-attendee drawer. Search, status filter and
pagination adopt the shared components. Permission flags, per-action busy
state and the Cancel confirmation are preserved exactly.

## Run order

Ninth. Depends on sheets 01–03 (primitives, toolbar, drawer). No new API
changes: `/api/events/[id]/attendees/manage` already supports `search`,
`status`, `page`.

## Files touched

- `src/modules/events/components/admin-attendee-management.tsx`
- Tests: `test/admin-attendee-management.test.tsx`

## Prerequisites

- Sheets 01–08 complete and verified.

## Steps

1. **Table** — replace the hand-rolled `<table>` with the shared primitives
   (columns: Attendee, Status, Survey, plus a trailing chevron `TableHeadCell`).
   `TableRow` gets `onClick={() => setSelected(attendee)}` and an aria-label
   like `Manage ${attendee.full_name}`. Replace the status/survey hand-rolled
   pills with the shared `Badge` (success/error/default variants) — the visual
   result is unchanged. Replace the search `Input` with `TableSearch` and the
   filter buttons with `FilterTabs` (tabs `all`/`checked_in`/`not_checked_in`).
   Replace the prev/next block with `Pagination`.
2. **Drawer** — hold `const [selected, setSelected] = useState<AdminAttendeeRow | null>(null)`
   and render `Drawer open={selected !== null} title={selected?.full_name}`.
   Body: avatar + name + email, ticket status pill (with check-in time), survey
   state, issued-at. Footer: the action `Button`s in their current order
   (primary Check in, secondary Send survey, ghost Resend ticket, ghost Cancel
   with `text-error`), each gated by its `can_*` flag and busy state, with the
   existing `run()` helper and Cancel's `confirm()` prompt. The row itself
   renders no buttons.
3. Keep the `surveySendable` notice and the error banner; the busy spinner for
   the action currently in flight moves into the drawer footer (the row the
   user clicked is the one the drawer shows).
4. **Tests** — `test/admin-attendee-management.test.tsx`: the existing action
   tests now open the drawer first (`await user.click(row)` then assert the
   drawer, then click the action). Keep asserting the exact fetch URLs
   (`.../checkin`, `.../cancel`, search/status params). Add a test that a row
   with no `can_*` flags shows the drawer with no action buttons.
5. Raise `vitest.config.ts` thresholds by whatever these tests add.

## Verification

- `pnpm typecheck` passes.
- `pnpm test` passes with coverage at or above the pre-sheet thresholds.
- `pnpm lint` and `pnpm format` pass.
- `rg "checkin|resend|survey|cancel" src/modules/events/components/admin-attendee-management.tsx`
  shows the action strings only inside the drawer.
- Manually in `pnpm dev` (admin role): click a row, run each action from the
  drawer, confirm Cancel prompts.

## Risks

- Moving actions into a drawer changes the test flow: existing tests that
  clicked in-row buttons will fail until rewritten in step 4 — do not delete
  the action coverage, migrate it.
- `can_*` flags come from the row payload; the drawer must read them from the
  selected row, not refetch.
