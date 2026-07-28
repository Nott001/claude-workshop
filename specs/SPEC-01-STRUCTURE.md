# SPEC-01: Phase A — Compilation (A1-A3)

Goal: `pnpm lint` passes, initial routes render.

---

## A1. Missing Module Source Files (P0)

Tests and API routes import from empty module directories. Create each source file.

### A1a. `src/modules/chat/lib/schemas.ts`

```ts
import { z } from "zod";

export const chatChannelEnum = z.enum(["support", "live_qa"]);

export const sendMessageSchema = z.object({
  channel: chatChannelEnum,
  message: z.string().min(1).max(1000),
  reply_to: z.number().int().positive().optional(),
  answered_verbally: z.boolean().optional(),
});
```

### A1b. `src/modules/chat/lib/rate-limit.ts`

```ts
export const RATE_LIMIT_WINDOW_MS = 5000;
export const RATE_LIMIT_MAX = 5;

export function isRateLimited(count: number): boolean {
  return count >= RATE_LIMIT_MAX;
}
```

### A1c. `src/modules/audit/lib/index.ts`

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export async function logAuditEvent(
  supabase: SupabaseClient,
  actorId: number,
  action: string,
  entityType: string,
  entityId: number | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from("AUDIT_LOG").insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata: metadata ?? null,
  });
  if (error) {
    console.error("Audit log insert failed:", error);
  }
}
```

### A1d. `src/modules/courses/lib/schemas.ts`

```ts
import { z } from "zod";

export const contentTypes = ["pdf", "video", "image", "link"] as const;

export function getContentTypeLabel(ct: string): string {
  return ct.toUpperCase();
}

export const courseSchema = z.object({
  course_name: z.string().min(1).max(255),
  course_description: z.string().nullable().optional(),
});

export const moduleSchema = z.object({
  module_name: z.string().min(1),
  sequence_order: z.coerce.number().int().positive(),
});

export const lessonSchema = z.object({
  description: z.string().min(1),
  content_type: z.enum(contentTypes),
  content_url: z.string().nullable().optional(),
  sequence_order: z.coerce.number().int().positive(),
});
```

### A1e. `src/modules/kiosk/lib/schemas.ts`

```ts
import { z } from "zod";

export const checkinSchema = z.object({
  qr_token: z.string().min(1),
});

export type CheckinResult =
  | { status: "success"; attendee: { full_name: string; email: string } }
  | { status: "duplicate"; ticket: { status: string; payment_id: number } }
  | { status: "rejected"; reason: string };

export function formatCheckinResult(ticket: {
  status: string;
  USER: { full_name: string; email: string } | null;
  payment_id: number;
}): CheckinResult {
  switch (ticket.status) {
    case "issued":
      return {
        status: "success",
        attendee: {
          full_name: ticket.USER?.full_name ?? "Unknown",
          email: ticket.USER?.email ?? "",
        },
      };
    case "checked_in":
      return { status: "duplicate", ticket: { status: ticket.status, payment_id: ticket.payment_id } };
    case "cancelled":
      return { status: "rejected", reason: "cancelled" };
    default:
      return { status: "rejected", reason: "unknown" };
  }
}
```

### A1f. `src/modules/notifications/lib/schemas.ts`

```ts
import { z } from "zod";

export const emailLogFilterSchema = z.object({
  email_type: z.enum(["ticket_issued", "check_in_confirmed"]).optional(),
  status: z.enum(["sent", "failed"]).optional(),
  user_id: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});
```

---

## A2. Pages Importing Non-Existent UI Components (P0)

~15 pages import from `@/modules/*/ui/*` directories that don't exist. Replace each with an inline stub.

**Pattern for each:**

```tsx
// Replace missing import with inline fallback
function MissingComponent(_props: Record<string, unknown>) {
  return <div className="p-4 text-sm text-muted-foreground">[Coming soon]</div>;
}
```

### Page-by-page changes

| Page | Missing Import | Fix |
|------|---------------|-----|
| `src/app/page.tsx` | `LandingContent` from `@/modules/event-management/ui/landing-content` | Inline hero section from `src/app/home/page.tsx` |
| `src/app/events/page.tsx` | `EventGrid` from `@/modules/event-management/ui/event-grid` | Remove import (unused; page iterates `filteredEvents` directly) |
| `src/app/events/[id]/page.tsx` | `FacilitatorEventDetail`/`AttendeeEventDetail` | Inline simple page showing event data from `useEventDetail` |
| `src/app/events/[id]/room/page.tsx` | `RoomCurriculum`/`LessonViewerModal` | Inline no-curriculum state (existing `"no_course"` branch) |
| `src/app/events/new/page.tsx` | `EventCreateForm`/`useEventCreate` | Basic form using `eventSchema` |
| `src/app/events/[id]/edit/page.tsx` | `EventEditForm`/`useEventEdit` | Same form pattern as new |
| `src/app/sign-in/[[...sign-in]]/page.tsx` | `SignInForm` | Simple Sign-In page |
| `src/app/sign-up/[[...sign-up]]/page.tsx` | `SignUpForm` | Simple Sign-Up page |
| `src/app/courses/[id]/page.tsx` | `LessonDialog`/`CurriculumBuilder` | Inline stub |
| `src/app/kiosk/page.tsx` | `KioskEventSelector`/`KioskScannerView` | Inline stub wrapping `useKiosk` |
| `src/app/speakers/dashboard/page.tsx` | `RoomCurriculum` | Inline stub |
| `src/app/support/page.tsx` | 5 support UI components + `useSupportChat` | Inline stub |
| `src/app/organization/page.tsx` | Organization UI components | Inline stub |
| `src/app/user/[[...rest]]/page.tsx` | Auth UI components | Inline stub |
| `src/app/events/[id]/speakers/page.tsx` | Missing speaker UI | Inline stub |

---

## A3. Test Modules Import From Empty Directories (P0)

Resolved by A1. Test imports for `chat.test.ts`, `qa-panel.test.ts`, `course-content.test.ts`, `kiosk.test.ts`, `notifications.test.ts` will resolve once A1 creates the source files.

No additional test changes needed.
