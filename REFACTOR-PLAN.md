# Refactor Plan: Modular Monolith + Centralized Data Access

## Branch

```
refactor/modular-monolith
```

## Goal

Convert the project from a flat monolith (inline Supabase queries scattered across route handlers) into a **modular monolith** with:

1. A centralized **repository/DAO layer** (`src/lib/db/repositories/`)
2. **Self-contained modules** in `src/modules/` that own their business logic
3. **Thin API routes** that delegate to modules + repositories
4. All table/column names **aligned to the new SQL schema** (singular table names, `id` PKs, `auth_user_id` instead of `clerk_id`)

---

## New SQL Schema Table Mapping

| Old Name | New Name | PK Change | Notable Column Changes |
|----------|----------|-----------|----------------------|
| `USERS` | `USER` | `user_id` → `id` | `clerk_id` → `auth_user_id` |
| `EVENTS` | `EVENT` | `event_id` → `id` | `lat`/`lng` removed |
| `COURSE` | `COURSE` | `course_id` → `id` | (no change) |
| `MODULES` | `MODULE` | `module_id` → `id` | (no change) |
| `LESSONS` | `LESSON` | `lesson_id` → `id` | (no change) |
| `PAYMENTS` | `PAYMENT` | `payment_id` → `id` | (no change) |
| `TICKETS` | `TICKET` | (composite) → `id` | `checked_in_at` added |
| `AUDIT_LOGS` | `AUDIT_LOG` | `log_id` → `id` | (no change) |
| `EMAIL_LOGS` | `EMAIL_LOG` | `log_id` → `id` | (no change) |
| `SPEAKER_PROFILES` | `SPEAKER_PROFILE` | `speaker_profile_id` → `id` | `photo_url` removed; social links added |
| `EVENT_SPEAKERS` | `EVENT_SPEAKER` | (composite) → composite | (no change) |
| `LIVE_SESSION_STATE` | `LIVE_SESSION_STATE` | (same) | (no change) |
| `CHAT_MESSAGES` | `CHAT_MESSAGE` | `message_id` → `id` | `session_id` FK added; `global_support` channel removed |
| `SUPPORT_SESSIONS` | `SUPPORT_SESSION` | `session_id` → `id` | (no change) |

**New tables:** `SYSTEM_SETTING`, `EVENT_FACILITATOR`, `STAFF_INVITE`, `COMMUNITY_LINK`, `SURVEY`, `SURVEY_QUESTION`, `SURVEY_RESPONSE`, `SURVEY_ANSWER`

---

## Architecture Decisions

- **Repository location:** `src/lib/db/repositories/` (one file per entity)
- **Client injection:** Every repository function takes `supabase: ServiceClient` as its first parameter (dependency injection — matches the existing `audit` module pattern)
- **No RLS reliance on backend:** All API routes continue using the **service-role client** (`getServiceClient()`) as they do today. The anon `supabase` client is used only for realtime subscriptions.
- **Table/column constants:** A `src/lib/db/tables.ts` file to eliminate magic strings. Each constant is an object with props for table name and column names.

---

## Phases

### Phase 0 — Table/Column Name Constants

**File:** `src/lib/db/tables.ts`

Named exports for every table and its columns. Example:

```ts
export const USER = {
  TABLE: "USER",
  ID: "id",
  AUTH_USER_ID: "auth_user_id",
  FULL_NAME: "full_name",
  EMAIL: "email",
  ROLE: "role",
  PROFILE_IMAGE_URL: "profile_image_url",
  CREATED_AT: "created_at",
  UPDATED_AT: "updated_at",
} as const;

export const EVENT = {
  TABLE: "EVENT",
  ID: "id",
  COURSE_ID: "course_id",
  TITLE: "title",
  EVENT_DATE: "event_date",
  // ... all columns
} as const;
```

**Status:** `⬜ PENDING`

---

### Phase 1 — Repository Layer

**Directory:** `src/lib/db/repositories/`

One file per domain entity. Convention:

```ts
// src/lib/db/repositories/user.ts
import type { getServiceClient } from "@/lib/db";
import { USER } from "@/lib/db/tables";

type ServiceClient = ReturnType<typeof getServiceClient>;

export async function findByClerkId(supabase: ServiceClient, clerkId: string) {
  return supabase
    .from(USER.TABLE)
    .select("*")
    .eq(USER.AUTH_USER_ID, clerkId)
    .single();
}

export async function upsertUser(supabase: ServiceClient, data: Record<string, unknown>) {
  return supabase
    .from(USER.TABLE)
    .upsert(data, { onConflict: USER.AUTH_USER_ID })
    .select()
    .single();
}

// ... etc
```

**Files to create (in order of dependency):**

| File | Entity | Key Operations |
|------|--------|---------------|
| `user.ts` | USER | findByClerkId, findById, upsert, updateRole, delete |
| `course.ts` | COURSE | findAll, findById, create, update, delete |
| `module.ts` | MODULE | findByCourseId, create, update, delete |
| `lesson.ts` | LESSON | findByModuleId, create, update, delete |
| `event.ts` | EVENT | findAll (with filters), findById (with joins), create, update, delete (cascade) |
| `event-facilitator.ts` | EVENT_FACILITATOR | findByEventId, assign, unassign |
| `speaker-profile.ts` | SPEAKER_PROFILE | findByUserId, create, update, upsert, delete |
| `event-speaker.ts` | EVENT_SPEAKER | findByEventId, assign, unassign |
| `live-session-state.ts` | LIVE_SESSION_STATE | findByEventId, upsert |
| `payment.ts` | PAYMENT | findByEventId, findByUserId, create, updateStatus, deleteByIds |
| `ticket.ts` | TICKET | findByEventId, findByUserId, findByPaymentId, create, updateStatus, deleteByPaymentIds |
| `chat-message.ts` | CHAT_MESSAGE | findByEventId, create, update, softDelete |
| `support-session.ts` | SUPPORT_SESSION | findByUserId, create, updateStatus, delete (with cascade to messages) |
| `audit-log.ts` | AUDIT_LOG | create |
| `email-log.ts` | EMAIL_LOG | create, findAll, findById |
| `staff-invite.ts` | STAFF_INVITE | create, findByEventId, updateStatus |
| `community-link.ts` | COMMUNITY_LINK | create, findByEventId, delete |
| `survey.ts` | SURVEY | create, findByEventId, findByCourseId |
| `survey-question.ts` | SURVEY_QUESTION | create, findBySurveyId |
| `survey-response.ts` | SURVEY_RESPONSE | create, findBySurveyId, findByUserId |
| `survey-answer.ts` | SURVEY_ANSWER | create, findByResponseId |
| `system-setting.ts` | SYSTEM_SETTING | get, set |

**Barrel file:** `src/lib/db/repositories/index.ts` — re-exports all functions.

**Status:** `⬜ PENDING`

---

### Phase 2 — Expand Modules with Business Logic

Move business logic out of API routes and into the matching modules. Each module currently only has Zod schemas + pure helpers. They should be expanded to own their domain's data operations.

**Current module inventory:**

| Module | Current State | What to Add |
|--------|---------------|-------------|
| `audit/` | `logAuditEvent()` with injected supabase — keep as-is | Nothing |
| `chat/` | Zod schemas, rate-limit logic — keep as-is | Nothing |
| `commerce/` | Schemas + `SimulatedPaymentGateway` (has inline DB calls) | Strip inline DB calls; accept repositories |
| `course-content/` | Zod schemas | `createCourse()`, `updateCourse()`, `deleteCourse()`, `createModule()`, etc. |
| `event-management/` | Zod schemas | `createEvent()`, `updateEvent()`, `publishEvent()`, `deleteEvent()` |
| `kiosk/` | Check-in schema + formatting — keep as-is | Nothing |
| `notifications/` | Filter schema + `fireAndForgetEmailNotification()` (has inline DB call) | Strip inline DB call; use email-log repository |

**Pattern:** Each module function accepts the repositories it needs (or the supabase client):

```ts
// src/modules/event-management/index.ts
export async function createEvent(
  supabase: ServiceClient,
  data: z.infer<typeof eventSchema>,
  actorClerkId: string,
) {
  // validate
  const parsed = eventSchema.parse(data);
  // create via repository
  const event = await eventRepo.create(supabase, parsed);
  // audit
  await logAuditEvent(supabase, actorClerkId, "event.created", "event", event.id, { title: event.title });
  return event;
}
```

**Status:** `⬜ PENDING`

---

### Phase 3 — Thin API Routes

Every `src/app/api/<resource>/route.ts` becomes a thin controller:

```ts
// Before (current pattern)
export async function POST(req: Request) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) return NextResponse.json({ error: guard.error }, { status: 401 });
  const body = await req.json();
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const supabase = getServiceClient();
  // ... 20 lines of inline queries
}

// After
export async function POST(req: Request) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) return NextResponse.json({ error: guard.error }, { status: 401 });
  const body = await req.json();
  const supabase = getServiceClient();
  const userId = (await auth()).userId!;
  try {
    const event = await createEvent(supabase, body, userId);
    return NextResponse.json(event, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.flatten() }, { status: 400 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
```

**All API route files to refactor (40+):**

- `app/api/auth/route.ts`
- `app/api/audit-logs/route.ts`
- `app/api/checkin/route.ts`
- `app/api/courses/route.ts` + `[id]/route.ts` + `[id]/modules/route.ts`
- `app/api/events/route.ts` + `[id]/route.ts` + `[id]/attendees/route.ts` + `[id]/publish/route.ts` + `[id]/register/route.ts` + `[id]/speakers/route.ts` + `[id]/speakers/[profileId]/route.ts` + `[id]/live/highlight/route.ts`
- `app/api/lessons/[id]/route.ts`
- `app/api/logs/route.ts` + `[id]/route.ts`
- `app/api/modules/[id]/route.ts` + `[id]/lessons/route.ts`
- `app/api/organization/route.ts` + `[userId]/route.ts`
- `app/api/payments/route.ts` + `[id]/route.ts`
- `app/api/speakers/route.ts` + `[id]/route.ts` + `me/route.ts` + `me/events/route.ts` + `me/events/[eventId]/route.ts`
- `app/api/tickets/route.ts` + `[paymentId]/route.ts`
- `app/api/support/route.ts` + `[messageId]/route.ts` + `users/route.ts` + `sessions/route.ts` + `sessions/[userId]/route.ts`
- `app/api/upload/event-image/route.ts` + `course-video/route.ts` + `course-asset/route.ts` + `profile-image/route.ts`
- `app/api/storage/[bucket]/[...path]/route.ts`
- `app/api/chat/[eventId]/route.ts` + `[eventId]/[messageId]/route.ts`

**Status:** `⬜ PENDING`

---

### Phase 4 — Align Types with New Schema

**File:** `src/types/index.ts`

Update all interfaces to match the new schema:

```ts
export interface User {
  id: number;              // was: user_id
  full_name: string;
  email: string;
  auth_user_id: string;    // was: clerk_id (UUID from Clerk)
  role: UserRole;
  profile_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: number;              // was: event_id
  course_id: number | null;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue_address: string | null;
  venue_name: string;
  description: string | null;
  price: number;
  currency: string;
  cover_image_url: string | null;
  status: EventStatus;
  facilitator_surveys_enabled: boolean;  // new field
  created_at: string;
  updated_at: string;
  // lat/lng removed
}
```

**Add types for new tables:**
- `SystemSetting`, `StaffInvite`, `CommunityLink`, `EventFacilitator`
- `Survey`, `SurveyQuestion`, `SurveyResponse`, `SurveyAnswer`

**Update `ChatChannel`:** Remove `"global_support"` (no longer in the schema).

**Status:** `⬜ PENDING`

---

### Phase 5 — Update All References Across the Codebase

Files that directly reference old table/column names and need updating:

| File | What to Update |
|------|---------------|
| `src/lib/auth/sync-user.ts` | `USERS` → `USER`, `clerk_id` → `auth_user_id` |
| `src/lib/landing.ts` | `EVENTS` → `EVENT`, `COURSE` → `COURSE`, column renames |
| `src/lib/storage/index.ts` | Dynamic import pattern, no table changes needed |
| `src/lib/realtime/index.ts` | `TICKETS` → `TICKET`, `SUPPORT_SESSIONS` → `SUPPORT_SESSION`, column renames |
| `src/middleware.ts` | (no DB references — no change) |
| All page files in `src/app/` | Any direct DB queries or type casts referencing old columns |

**Status:** `⬜ PENDING`

---

### Phase 6 — Update Tests

**File:** `src/test/`

Update all 13 test files to:
1. Use new type interfaces (singular table names, `id` PKs)
2. Mock data aligned with new schema
3. Add repository unit tests (mock supabase client, test each function)

**Files to update:**

| Test File | Focus |
|-----------|-------|
| `foundation.test.ts` | Base utilities |
| `event-management.test.ts` | Event schemas + new module logic |
| `course-content.test.ts` | Course schemas + new module logic |
| `commerce.test.ts` | Payment state machine, ticket state machine |
| `chat.test.ts` | Rate limiting, message validation |
| `kiosk.test.ts` | Check-in validation |
| `notifications.test.ts` | Email filter schema |
| `storage.test.ts` | Storage operations |
| `sync-user.test.ts` | Auth sync logic |
| `landing.test.ts` | Landing page queries |
| `qa-panel.test.ts` | Q&A panel |
| `qr-scanner.test.ts` | QR scanner |
| `live-highlight.test.ts` | Live session state |

**Add new test files:**
- `repository-user.test.ts`
- `repository-event.test.ts`
- `repository-payment.test.ts`
- `repository-ticket.test.ts`

**Status:** `⬜ PENDING`

---

## Execution Order

Each phase must be completed before the next begins (files compiled in Phase 1 are imported by Phase 2, etc.):

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6
```

Within each phase, work bottom-up by dependency:
- Repositories: `user.ts` first (many things depend on user lookups), then entities without FKs, then entities with FKs
- API routes: auth/service routes first, then CRUD routes for each entity
- Types: update all at once (single file)

## Verification

After each phase:

```bash
pnpm format
pnpm lint
pnpm test
pnpm dev     # smoke test: load pages, hit API routes
```

No `pnpm build` (as per AGENTS.md).