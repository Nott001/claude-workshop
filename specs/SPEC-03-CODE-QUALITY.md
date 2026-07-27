# SPEC-03: Phase C — Code Quality & Architecture (C1-C12)

Goal: Types, error handling, architecture tightened.

---

## C1. Redundant `requireAuth` in API Routes (P2)

**Where:** All API route files.

**Problem:** Routes call `requireRole` (which calls `requireAuth`) then call `requireAuth` again for audit logging.

**Fix:** Create combined helper in `src/modules/auth/lib/role-guard.ts`:

```ts
export async function authAndGuard(
  supabase: ReturnType<typeof getServiceClient>,
  ...allowedRoles: string[]
): Promise<{ user: AuthUser | null; allowed: boolean; error: string | null }> {
  const user = await requireAuth(supabase);
  if (!user) return { user: null, allowed: false, error: "Unauthenticated" };
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return { user, allowed: false, error: "Forbidden" };
  }
  return { user, allowed: true, error: null };
}
```

Update all 42 API route handlers to call this once and use the returned `user` for audit.

---

## C2. `ensureUser` Dead Logic (P2)

**Where:** `src/modules/auth/ensure-user.ts`

**Problem:** `ensureUser` redundantly calls `findByAuthId` before creating — but `requireAuth` already did this.

**Fix:** Remove the redundant check. The function only creates:

```ts
export async function ensureUser(supabase: ServiceClient, authUserId: string): Promise<AuthUser | null> {
  const created = await userDao.upsertUser(supabase, {
    auth_user_id: authUserId,
    email: "",
    full_name: "",
    role: "attendee",
  });
  if (!created) return null;
  return { id: created.id, role: created.role, full_name: created.full_name, email: created.email };
}
```

(Email/name fix handled by B9.)

---

## C3. Type Duplication in Auth Module (P2)

**Where:** `src/modules/auth/lib/types.ts`, `src/modules/auth/components/session-context.tsx`

**Fix:** In `session-context.tsx`, import the canonical type and remove the local interface:

```ts
import type { AuthUser } from "../lib/types";
```

---

## C4. `app-shell.tsx` Double-Fetches Auth (P2)

**Where:** `src/components/app-shell.tsx`

**Problem:** `AppShell` fetches `/api/auth/me` in a useEffect but `SessionProvider` already did.

**Fix:** Extract `role` from `useSession()` directly:

```tsx
const { isSignedIn, user } = useSession();
const role = user?.role ?? null;
```

Remove the entire `useEffect` block that fetches `/api/auth/me`.

---

## C5. Layout `<SessionProvider>` Wraps `<html>` (P2)

**Where:** `src/app/layout.tsx`

**Problem:** `SessionProvider` (client component) wraps `<html>`.

**Fix:** Move `SessionProvider` inside `<body>`:

```tsx
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <SessionProvider>
          <AppShell>{children}</AppShell>
        </SessionProvider>
      </body>
    </html>
  );
}
```

---

## C6. `event.dao.ts` `updateField` is Unsafe (P2)

**Where:** `src/lib/db/dao/event.dao.ts`

**Fix:** Type the field parameter:

```ts
type EventUpdatableField = "title" | "event_date" | "start_time" | "end_time" | "venue_name" | "venue_address" | "description" | "course_id" | "price" | "currency" | "cover_image_url" | "status";

export async function updateField(
  supabase: DbClient,
  id: number,
  field: EventUpdatableField,
  value: unknown,
): Promise<boolean> { ... }
```

---

## C7. App Has No Error Boundaries (P2)

**Create:** `src/shared/components/ui/error-boundary.tsx`:

```tsx
"use client";
import { Component } from "react";

interface Props { children: React.ReactNode; fallback?: React.ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state = { hasError: false, error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="text-center">
            <p className="text-sm text-error">Something went wrong.</p>
            <button onClick={() => this.setState({ hasError: false, error: null })} className="mt-2 text-sm text-brand underline">
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

Wrap main content in `AppShell`:

```tsx
<ErrorBoundary>
  <main className="flex flex-1 flex-col overflow-auto lg:pl-[202px]">{children}</main>
</ErrorBoundary>
```

---

## C8. DAO Functions Return `unknown` Types (P1)

**Where:** `src/lib/db/dao/ticket.dao.ts`, `src/lib/db/dao/chat.dao.ts`

**Fix:** Define proper return types:

- `findByQrToken`: `Promise<Ticket & { USER: Pick<User, "full_name" | "email"> } | null>`
- `getAttendees`: Define `AttendeeRow` interface, use `Promise<{ data: AttendeeRow[]; total: number }>`
- Remove all `as unknown as X` casts

---

## C9. `fireAndForgetEmailNotification` Error Handling (P2)

**Where:** `src/modules/notifications/email.ts`

**Problem:** Errors inside `Promise.allSettled` IIFE are silently consumed.

**Fix:** Add error logging, rename to `sendEmailNotification`:

```ts
export async function sendEmailNotification(params: { ... }) {
  try {
    const result = await sendEmail({ ... });
    const supabase = getServiceClient();
    await emailDao.insert(supabase, {
      user_id: params.user_id,
      email_type: params.email_type,
      status: result.success ? "sent" : "failed",
      sent_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Email notification failed:", err);
  }
}
```

---

## C10. `read_by` Column is Dead Code (P3)

**Where:** `src/types/index.ts`

**Fix:** Remove `read_by: number[]` from `ChatMessage` type.

---

## C11. `DbClient` Type Alias Provides No Value (P3)

**Where:** `src/lib/db/dao/types.ts`

**Fix:** Remove the `DbClient` alias. Use `SupabaseClient` directly everywhere.

---

## C12. `tsconfig.json` Targets ES2017 (P2)

**Where:** `tsconfig.json`

**Fix:** Change `"target": "ES2017"` → `"target": "ES2022"`.
