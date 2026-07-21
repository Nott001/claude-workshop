# Phase 2 — Architecture & Module Planning

## Modules (schema entity ownership)

| Module | Entities |
|---|---|
| **Identity/Auth** | USERS (via Clerk) |
| **Course Content** | COURSE, MODULES, LESSONS, LESSON_PROGRESS |
| **Event Management** | EVENTS (including price/currency, status), EVENT_SPEAKERS, SPEAKER_PROFILES |
| **Live Session Room** | LIVE_SESSION_STATE |
| **Chat/Q&A** | CHAT_MESSAGES |
| **Commerce** | PAYMENTS (including amount/currency snapshotted from event), TICKETS |
| **Kiosk/Check-in** | TICKETS (read + status update) |
| **Surveys** | SURVEYS, SURVEY_QUESTIONS, SURVEY_RESPONSES, SURVEY_ANSWERS |
| **Notifications** | EMAIL_LOGS |

## Recommended Stack

| Layer | Choice | Justification |
|---|---|---|
| Framework | Next.js 16 (App Router) | Already initialized; full-stack React, file-based routing, API route co-location |
| Styling | Tailwind CSS v4 + shadcn/ui | Already on Tailwind v4; shadcn adds Radix-based component primitives |
| Auth | Clerk | Specified in OVERVIEW.md; webhook sync for USERS table |
| Database | Supabase (PostgreSQL) | Managed Postgres with typed client SDK |
| Real-time | Supabase Realtime (Postgres LISTEN/NOTIFY via Realtime) | Zero additional infra — when LIVE_SESSION_STATE updates, the change event broadcasts to subscribed clients. **vs Socket.io:** Supabase Realtime avoids a separate WebSocket server or custom Node server, reducing deployment complexity and keeping data authority in Postgres. **Setup:** Realtime must be enabled per-table via Supabase Dashboard → Database → Replication. Required tables: `LIVE_SESSION_STATE`, `CHAT_MESSAGES`, `TICKETS`. |
| Payments | HitPay | Specified in scope; webhook-based async flow |
| Email | Resend | Transactional email API via Resend SDK |
| Monitoring | Sentry (errors) + Statuscake (uptime) | As specified |

## Data Flow Diagrams

### Flow 1: Payment → Ticket → QR Check-in

```
Attendee                Next.js API             Supabase          HitPay            Kiosk
   |                        |                       |                 |                 |
   |--- POST /api/payments ->|                       |                 |                 |
   |                        |--- create PAYMENT ---->|                 |                 |
   |                        |--- redirect to HitPay -->|                 |                 |
   |--- [HitPay checkout] --------------------------------------------------->|                 |
   |<--- HitPay redirect ---|                       |                 |                 |
   |                        |<- webhook (paid) ------|                 |                 |
   |                        |--- update status ---->|                 |                 |
   |                        |--- insert TICKET ---->|                 |                 |
   |                        |--- log EMAIL_LOGS --->|                 |                 |
   |<-- status: paid + QR --|                       |                 |                 |
   |                        |                       |                 |                 |
   |                        |                       |                 |    [at venue]
   |                        |                       |                 |--- scan QR ---->|
   |                        |<-- POST /api/checkin --------------------|                 |
   |                        |--- lookup TICKET ---->|                 |                 |
   |                        |--- if ok: update ------>|                 |                 |
   |                        |--- log EMAIL_LOGS ---->|                 |                 |
   |                        |---> { checked_in } --------------------------------------->|
```

### Flow 2: Speaker Advances Lesson → Broadcast

```
Speaker (browser)       Next.js API              Supabase          Attendee clients
   |                        |                       |                 |
   |--- PATCH /api/live --->|                       |                 |
   |                        |--- validate lesson --->|                 |
   |                        |--- UPDATE state ------>|                 |
   |                        |                       |--- Realtime --->|
   |                        |                       |   broadcast     |
   |<-- { ok } ------------|                       |                 |
   |                        |                       |                 |--- update UI --|
   |                        |                       |                 | (new lesson)   |
```

## Folder Structure

```
app/
  api/
    auth/           (Clerk webhooks — sync user to DB)
    courses/        (Course Content CRUD)
    events/         (Event Management CRUD)
    payments/       (Commerce API + HitPay webhook)
    checkin/        (Kiosk check-in endpoint)
    live/           (Live Session Room state)
    chat/           (Chat message CRUD)
    surveys/        (Surveys API)
  (auth)/           Sign-in, Sign-up pages (Clerk)
  events/           Event list + detail pages
  dashboard/        Facilitator home
  kiosk/            Check-in kiosk page
  live/             Live session room page
  surveys/          Survey pages
  layout.tsx        (existing — wrap with ClerkProvider)
  globals.css       (existing)
components/
  ui/               shadcn/ui primitives (button, input, card, etc.)
  layout/           Shell, nav bar, sidebar, protected-route wrappers
lib/
  db/               Supabase typed client + query helpers
  auth/             Clerk middleware helpers, role guards
  hitpay/           HitPay signature verification + API calls
  realtime/         Supabase Realtime channel setup
  email/            Resend client wrapper
  qr/               QR code generation
modules/
  course-content/   Domain logic (course <-> module <-> lesson)
  event-management/ Domain logic (event + speaker assignment)
  live-session/     Domain logic (state transitions + broadcast)
  chat/             Domain logic (message validation + channel routing)
  commerce/         Domain logic (payment lifecycle + ticket issuance)
  kiosk/            Domain logic (QR lookup + check-in rules)
  surveys/          Domain logic (survey CRUD + response validation)
  notifications/    Domain logic (email log + send)
types/              Shared TypeScript interfaces (mirrors DB schema)
middleware.ts       Clerk auth middleware (protect routes by role)
```

## Implementation Order

| Step | Module | Depends On | Rationale |
|---|---|---|---|
| 1 | Foundation | — | Next.js, Clerk integration, Supabase client, shadcn/ui setup, middleware.ts |
| 2 | Course Content | 1 | No upstream domain deps; content must exist before events can reference it |
| 3 | Event Management | 2 | Needs courses/modules/lessons to link; speakers need profiles |
| 4 | Commerce | 3 | Needs events for ticket targeting |
| 5 | Kiosk/Check-in | 4 | Needs tickets + QR to scan |
| 6 | Live Session Room | 2, 3 | Needs course content (lessons) + event context |
| 7 | Chat/Q&A | 6 | Runs within the live session room |
| 8 | Surveys | 3 | Needs event context |
| 9 | Notifications | 4, 5, 6, 8 | Needs commerce/check-in/live/survey events to log |

## Acceptance Criteria

- [x] Every schema entity is owned by exactly one module.
- [x] Real-time transport choice includes explicit reasoning against next-best alternative (Socket.io).
- [x] Implementation order has no forward dependency violations.
