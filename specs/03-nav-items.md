# 03. Rename the speaker nav item to "My Events" at `/speaker/events`

## Goal

Update the speaker entry in the role nav map so the navbar no longer offers a
"Dashboard" link to a dead URL. The label becomes "My Events", matching the
facilitator nav item, and the href becomes `/speaker/events`. The speaker
navbar must stay the only way in and out of the speaker area — no `/staff`
route may appear for the speaker role.

## Run order

Third. Depends on sheet `01`; its labels/hrefs are asserted in sheets `07` and `08`.

## Files touched

- `src/modules/shell/lib/nav-items.ts`

## Prerequisites

- Sheet `01` complete.

## Steps

1. In `src/modules/shell/lib/nav-items.ts`, change the speaker entry (line 17):

   ```diff
   -    { label: "Dashboard", href: "/speaker/dashboard", icon: "event" },
   +    { label: "My Events", href: "/speaker/events", icon: "event" },
   ```

2. Leave `getNavItems()` and all other roles untouched. The facilitator entry at
   `/staff/events/assigned` is a separate route and stays as-is.

## Verification

- `grep -rn "speaker/dashboard" src/modules/shell` returns nothing.
- The speaker nav items render exactly `["My Events", "Community"]` (manual
  check, or via the updated test in sheet `07`).

## Risks / notes

- The label change is user-visible: links to the speaker home rendered by
  `post-login-redirect` and the guard are _paths_, not labels, so only the
  navbar copy "Dashboard" disappears. No other label is affected.
- `src/app/staff/audit-logs/page.tsx:75` also prints "Back to Dashboard"; that
  is the admin audit-log page pointing at `/staff`, is unrelated to the speaker
  rename, and must **not** be edited.
