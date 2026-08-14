# Unify staff table design — run spec

Each file in this directory is one spec sheet. They are **run sequentially**, in
filename order: `01` must be complete and verified before `02` starts, and so on.

Every sheet has the same shape: goal, run order, files touched, prerequisites,
steps, verification (definition of done) and risks. Do not skip the verification
section of a sheet — the next sheet depends on it.

The goal of the series is to unify the six staff-facing tables (Events list,
Admin attendee management, Kiosk attendees, Organization members, Audit logs,
Email logs) behind one shared table system. Today every table is
hand-rolled HTML with its own header style, its own search/filter/pagination
markup and, where it has them, its own in-cell action buttons. The series
builds shared primitives (`table`, `table-toolbar`, `table-pagination`,
`drawer`), adds server-side `search`/filter support to the three APIs that lack
it, then migrates each table — search and filtering everywhere, actions moved
out of cells into a drawer opened by clicking a row. Sheet 14 also removes the
orphaned Courses audit page: a course belongs to its event 1:1 and is reached
from the event's Course tab, so the standalone all-courses list and its list
endpoint are dead code.

Design decisions locked in for the whole series:

- **Shared look.** Container `overflow-hidden rounded-xl border border-border
bg-surface shadow-sm`; header `bg-muted px-5 py-3 text-xs font-semibold
uppercase tracking-wider text-muted-fg`; rows `divide-y divide-border
hover:bg-muted`; cells `px-5 py-4 text-sm`. Clickable rows get
  `cursor-pointer` and a trailing chevron affordance.
- **Row click opens a drawer, title stays a link.** Clicking anywhere on a row
  opens that row's drawer; where a cell is itself a navigation link (the event
  Title), the link keeps working via `stopPropagation`.
- **Search is server-side.** Filtering happens in the DAO so it is correct
  against the whole dataset, not just the rows already fetched. Debounced
  client-side before firing, so a keystroke does not mean a request.
- **All DB work runs under the service client.** The AGENTS.md warning about
  PostgREST embed grants applies to `anon`/`authenticated` reads; the DAOs here
  use `getServiceClient()`, so embed filters and `or(...)` conditions are fine.

Iterate with `pnpm dev` (hot reload). **Never use `pnpm build`.** Before any
commit run the four gates `pnpm format`, `pnpm lint`, `pnpm typecheck`,
`pnpm test` — the coverage thresholds in `vitest.config.ts` are a ratchet:
raise them when coverage rises, never lower them. Sheet 15 runs `pnpm
cf:preview` because sheets 02–14 introduce timers (debounced search) and
rendering primitives that only workerd proves.

**Commit cadence.** Commit once per sheet, on branch `feat/unify-tables`, with
an imperative conventional prefix (e.g. `feat(ui): add shared table
primitives`, `refactor(events): migrate event tables to shared primitives`).
Gates first, always. Sheet 15 is the final commit — it carries the CHANGELOG
entry and the whole-series verification, and its own diff is the changelog
only if the earlier sheets each committed.

| #   | Sheet                                                             | What it produces                                                          |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 01  | [`01-table-primitives`](01-table-primitives.md)                   | Branch created; shared `Table` primitives land in `src/shared/components` |
| 02  | [`02-toolbar-and-pagination`](02-toolbar-and-pagination.md)       | `TableSearch`, `FilterTabs`, `Pagination` shared components               |
| 03  | [`03-drawer`](03-drawer.md)                                       | Right-side `Drawer` over `@base-ui/react/dialog`                          |
| 04  | [`04-events-search-api`](04-events-search-api.md)                 | `/api/events` accepts `search`; `useEventList` debounced search           |
| 05  | [`05-audit-logs-search-api`](05-audit-logs-search-api.md)         | `/api/audit-logs` accepts `search`; `useAuditLogs` debounced search       |
| 06  | [`06-email-logs-search-api`](06-email-logs-search-api.md)         | `/api/logs` accepts `search` by user; `useEmailLogs` debounced search     |
| 07  | [`07-organization-search-api`](07-organization-search-api.md)     | `/api/organization` gains a `role` filter; search reuse confirmed         |
| 08  | [`08-migrate-event-table`](08-migrate-event-table.md)             | Events tables (admin + facilitator) on primitives, actions in drawer      |
| 09  | [`09-migrate-admin-attendees`](09-migrate-admin-attendees.md)     | Admin attendee table on primitives, actions in drawer                     |
| 10  | [`10-migrate-kiosk-panel`](10-migrate-kiosk-panel.md)             | Kiosk attendees panel on primitives, details in drawer                    |
| 11  | [`11-migrate-organization-page`](11-migrate-organization-page.md) | Organization members table on primitives, search + role filter + drawer   |
| 12  | [`12-migrate-audit-logs-page`](12-migrate-audit-logs-page.md)     | Audit logs on primitives, search + category filter + details drawer       |
| 13  | [`13-migrate-email-logs-page`](13-migrate-email-logs-page.md)     | Email logs on primitives, user search + details drawer                    |
| 14  | [`14-remove-courses-list-page`](14-remove-courses-list-page.md)   | Courses audit page, its `GET /api/courses` and the DAO read removed       |
| 15  | [`15-changelog-and-final-gates`](15-changelog-and-final-gates.md) | CHANGELOG entry; full gate run incl. `pnpm cf:preview`; series committed  |
