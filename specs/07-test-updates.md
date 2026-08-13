# 07. Update the tests that pin the renamed routes and labels

## Goal

Make the suite green against the new URLs and label. Every test that hard-codes
`/speaker/dashboard`, `/speaker/event/{id}/course`, or the "Dashboard" label is
updated; the speaker nav test gains the same href assertion the facilitator test
already has, so the "My Events" item is pinned to its route.

## Run order

Seventh. Must run after sheets `01`–`06`; its assertions are the definition of
done for the whole series, verified by `pnpm test`.

## Files touched

- `test/middleware.test.ts`
- `test/post-login-redirect.test.tsx`
- `test/sign-in-form.test.tsx`
- `test/events-page.test.tsx`
- `test/use-role-guard.test.tsx`
- `test/navbar-role-nav.test.tsx`

## Prerequisites

- Sheets `01`–`06` complete.

## Steps

1. **`test/middleware.test.ts`** — the protected-path table:
   - Line 51: `["/speaker/dashboard", undefined]` → `["/speaker/events", undefined]`
   - Line 52: `["/speaker/event/42/course", undefined]` → `["/speaker/events/42/course", undefined]`
   - These rows only assert protection, so the test bodies do not change.

2. **`test/post-login-redirect.test.tsx`** — line 34:
   `[ROLES.SPEAKER, "/speaker/dashboard"]` → `[ROLES.SPEAKER, "/speaker/events"]`

3. **`test/sign-in-form.test.tsx`** — line 62: same value change as step 2.

4. **`test/events-page.test.tsx`** — line 78: same value change as step 2.

5. **`test/use-role-guard.test.tsx`** — line 47:
   `expect(replace).toHaveBeenCalledWith("/speaker/dashboard")` →
   `expect(replace).toHaveBeenCalledWith("/speaker/events")`. Update the test
   description if it mentions "dashboard" (it asserts the _guard's_ fallback,
   not a page, so a wording tweak from `dashboard` to `events` is fine if the
   case name references it; otherwise leave it).

6. **`test/navbar-role-nav.test.tsx`** — the speaker nav test (lines 47–50):
   - Rename the case to read "shows a speaker My Events and Community — no route
     into /staff".
   - Change the expectation to `expect(navLabels()).toEqual(["My Events", "Community"])`.
   - Add a route assertion mirroring the facilitator test (lines 57–63): locate
     the "My Events" link inside the primary navigation and assert
     `link.getAttribute("href")` is `/speaker/events`.

## Verification

- `pnpm test` passes. No test may reference `/speaker/dashboard`,
  `/speaker/event/` (singular), or a "Dashboard" speaker label.
- `grep -rn "speaker/dashboard" test/` and `grep -rn "speaker/event" test/`
  both return nothing.

## Risks / notes

- The affected tests assert on behavior (network/router hops, nav hrefs), not
  type shapes — change only the expected values, never the mock setup, so the
  assertions keep exercising real code.
- The e2e `signIn` fixture derives its expected landing URL from `roleHome()`
  and needs no edit; it only re-verifies when sheet `08` runs the server.
