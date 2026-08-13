# 02. Point the speaker role home at `/speaker/events`

## Goal

Change `ROLE_HOME.speaker` so every code path that resolves a speaker's home
after sign-in lands on the renamed route. This is the single source for the
post-sign-in redirect, the role guard's fallback destination, and the
attendee-event-page bounce, so it must move before any of the call sites that
assert on it (sheet `07`).

## Run order

Second. Depends on sheet `01` for the route existing; is a prerequisite for the
test and guard assertions to make sense.

## Files touched

- `src/modules/auth/lib/role-home.ts`

## Prerequisites

- Sheet `01` complete: `src/app/speaker/events/page.tsx` exists.

## Steps

1. In `src/modules/auth/lib/role-home.ts`, change line 6:

   ```diff
   - speaker: "/speaker/dashboard",
   + speaker: "/speaker/events",
   ```

2. Leave the other roles unchanged. An explicit `?redirect_url` still beats the
   role home (handled in `post-sign-in-destination.ts`); nothing here affects it.

## Verification

- `grep -rn "speaker/dashboard" src/modules/auth` returns nothing.
- `grep -n "speaker" src/modules/auth/lib/role-home.ts` shows only
  `speaker: "/speaker/events",`.

## Risks / notes

- Callers that render a link to the speaker home (`use-role-guard.ts`,
  `post-sign-in-destination.ts`, `post-login-redirect.tsx`, `event-list.tsx`)
  need no edits — they reference the map, not the literal. Do not touch them.
- The e2e `signIn` fixture derives its expected URL from `roleHome()`, so it
  follows this change for free once the e2e app is rebuilt (sheet `08`).
