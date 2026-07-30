# SPEC-01-B — Facilitator Page Guards

Prerequisites: SPEC-01-A
After this: SPEC-01-C

## Scope

3 client-component pages. Add `hasMinRole` guards that deny access to anyone
below `facilitator`.

## Background

After SPEC-01-A, the navbar no longer shows `/staff/*` links to speakers, but
a speaker can still reach these pages by typing the URL. These three pages
belong to the facilitator role and must block speakers (and below).

## Changes

### 1. `src/app/staff/events/page.tsx`

Add at the top of the component body, after the `useEventList()` call:

```ts
const { user } = useSession();
const userRole = user?.role ?? null;
```

And after the `error` block and before the render return, add:

```ts
if (!hasMinRole(userRole, "facilitator")) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="text-sm text-error">Access denied.</div>
    </div>
  );
}
```

Import `useSession` from `@/modules/auth` and `hasMinRole` from
`@/shared/lib/role-hierarchy`.

The existing `NON_FACILITATOR_TABS` and the `isFacilitator` path remain in the
hook — they are unreachable from this page once the guard is in place, but
removing them is outside scope.

### 2. `src/app/staff/events/[id]/support/page.tsx`

This is a standalone page that can be navigated to directly, bypassing the
parent event detail page's guard. Add a guard at the top:

```ts
if (!hasMinRole(userRole, "facilitator")) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="text-sm text-error">Access denied.</div>
    </div>
  );
}
```

Place it after the `useSession()` call and before the return statement.

### 3. `src/app/staff/events/[id]/room/page.tsx`

Currently relies on `useRoomAccess` which allows assigned speakers through.
Add an explicit page-level guard that redirects speakers to their own room or
the attendee room. Add after the `useSession()` call and before the
`useRoomAccess()` call. Note: the condition must be `||` not `&&` — we wait
until loading is done AND the user object is resolved before checking:

```ts
useEffect(() => {
  if (!isLoaded || !user) return;
  if (!hasMinRole(userRole, "facilitator")) {
    router.replace(`/events/${eventId}/room`);
  }
}, [isLoaded, user, userRole, eventId, router]);
```

Also add a render-time guard after the `access === "loading"` check:

```ts
if (!hasMinRole(userRole, "facilitator")) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="text-sm text-muted-foreground">Redirecting...</div>
    </div>
  );
}
```

Import `useSession` from `@/modules/auth` and `hasMinRole` from
`@/shared/lib/role-hierarchy`. The file already imports `useEffect` — add
`useSession` to the existing import from `@/modules/auth`.

## Verification

- Sign in as `speaker` → navigate to `/staff/events` → "Access denied."
- Sign in as `speaker` → navigate to `/staff/events/[id]/support` → "Access denied."
- Sign in as `speaker` → navigate to `/staff/events/[id]/room` → redirected to `/events/[id]/room`
- Sign in as `facilitator` → all three pages render normally.
