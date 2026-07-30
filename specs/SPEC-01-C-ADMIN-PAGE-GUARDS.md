# SPEC-01-C — Admin Page Guards

Prerequisites: SPEC-01-B
After this: SPEC-01-D

## Scope

6 files — 5 client-component pages, 1 server-component page. Add guards that
deny access to anyone below `admin` (for the client pages) or below
`facilitator` (for the server component).

## Changes

### 1. `src/app/staff/events/new/page.tsx` (client)

Add guard after `const { user } = useSession();`:

```ts
const userRole = user?.role ?? null;

if (!hasMinRole(userRole, "admin")) {
  router.push("/staff/events");
  return null;
}
```

Or use a `useEffect` to redirect. Either way, a `facilitator` who visits
`/staff/events/new` must be sent back to `/staff/events`. A brief flash of the
form is acceptable; the API (`POST /api/events` changed in SPEC-01-D) also
rejects them.

Import `hasMinRole` from `@/shared/lib/role-hierarchy` and `useRouter` from
`next/navigation` (already imported).

### 2. `src/app/staff/emails/page.tsx` (client)

Add after the destructured hook values:

```ts
if (!hasMinRole(userRole, "admin")) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="text-sm text-error">Access denied.</div>
    </div>
  );
}
```

The page already imports `useSession` and receives `userRole` from
`useEmailLogs`. Import `hasMinRole` from `@/shared/lib/role-hierarchy`.

### 3. `src/app/staff/audit-logs/page.tsx` (client)

Add at the top of the component, before the return:

```ts
import { useSession } from "@/modules/auth";
import { hasMinRole } from "@/shared/lib/role-hierarchy";

// Inside the component:
const { user } = useSession();
const userRole = user?.role ?? null;

if (!hasMinRole(userRole, "admin")) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg">
      <div className="text-sm text-error">Access denied.</div>
    </div>
  );
}
```

### 4. `src/app/staff/organization/page.tsx` (client)

The page already has `isAdmin = hasMinRole(userRole, "admin")` used for action
visibility, but no block at the top. Add before the return statement:

```ts
if (!isAdmin) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="mx-auto max-w-4xl flex-1 p-8">
        <p className="text-sm text-error">Access denied.</p>
      </div>
    </div>
  );
}
```

### 5. `src/app/staff/support/page.tsx` (client)

Add after the `useSession()` call:

```ts
import { hasMinRole } from "@/shared/lib/role-hierarchy";

const userRole = user?.role ?? null;

if (!hasMinRole(userRole, "admin")) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="text-sm text-error">Access denied.</div>
    </div>
  );
}
```

### 6. `src/app/staff/events/[id]/edit/page.tsx` (server component)

This is a server component. It cannot use `hasMinRole`. Add a `requireRole`
check after the event fetch:

```ts
import { requireRole } from "@/modules/auth/lib/role-guard";

const guard = await requireRole("facilitator");
if (!guard.allowed) {
  throw new Error("Forbidden"); // or redirect
}
```

However, this page currently has no Supabase client to pass to `requireRole`.
The simplest approach: change it to a client component that checks
`hasMinRole(userRole, "facilitator")`, or keep it server-side and add a
`requireRole` call using the pattern from other server routes. The edit form
itself (`EditEventForm`) is already a client component, so making the page
client-side is acceptable:

```ts
"use client";

import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/modules/auth";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { EditEventForm } from "@/modules/events/components/edit-event-form";
import { useEffect, useState } from "react";

export default function StaffEditEventPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useSession();
  const userRole = user?.role ?? null;
  const eventId = params.id as string;

  useEffect(() => {
    if (!hasMinRole(userRole, "facilitator")) {
      router.replace("/staff/events");
    }
  }, [userRole, router]);

  if (!hasMinRole(userRole, "facilitator")) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Redirecting...</div>
      </div>
    );
  }

  return <EditEventForm eventId={eventId} />;
}
```

This avoids the server/client mismatch. The form already fetches its own
initial data from the API, so the server-side event fetch is redundant.

## Files changed

| File                                      | Guard         | Denial behaviour            |
| ----------------------------------------- | ------------- | --------------------------- |
| `src/app/staff/events/new/page.tsx`       | `admin`       | Redirect to `/staff/events` |
| `src/app/staff/emails/page.tsx`           | `admin`       | "Access denied."            |
| `src/app/staff/audit-logs/page.tsx`       | `admin`       | "Access denied."            |
| `src/app/staff/organization/page.tsx`     | `admin`       | "Access denied."            |
| `src/app/staff/support/page.tsx`          | `admin`       | "Access denied."            |
| `src/app/staff/events/[id]/edit/page.tsx` | `facilitator` | Redirect to `/staff/events` |

## Verification

- Sign in as `facilitator` → `/staff/events/new` → redirected to `/staff/events`.
- Sign in as `facilitator` → `/staff/emails` → "Access denied."
- Sign in as `facilitator` → `/staff/audit-logs` → "Access denied."
- Sign in as `facilitator` → `/staff/organization` → "Access denied."
- Sign in as `facilitator` → `/staff/support` → "Access denied."
- Sign in as `admin` → all six pages render normally.
