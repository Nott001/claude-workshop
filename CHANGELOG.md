# CHANGELOG

## [Unreleased]

### feat: add kiosk check-in flow with QR scanning and real-time attendee list

- **supabase/migrations/00008_enable_tickets_realtime.sql** — enable Realtime publication on TICKETS table for check-in list updates
- **modules/kiosk/index.ts** — domain logic: `checkinSchema` (qr_token validation), `formatCheckinResult()` returning success/duplicate/rejected discriminated result
- **lib/realtime/index.ts** — `subscribeToCheckins()` utility subscribing to TICKETS UPDATE events filtered by event_id; fires only when status=checked_in
- **app/api/checkin/route.ts** — POST (facilitator-only) looks up ticket by qr_token, validates status transitions (issued→checked_in), returns success with attendee info, duplicate for already-checked-in, or rejected for cancelled tickets
- **app/api/checkin/[eventId]/attendees/route.ts** — GET (facilitator-only) returns list of checked-in attendees with name, email, and check-in time
- **app/kiosk/page.tsx** — full-screen kiosk page: event picker, camera scanner via getUserMedia + BarcodeDetector (native API), manual QR token text input fallback, result overlay with auto-clear after 3s
- **app/kiosk/[eventId]/attendees/page.tsx** — checked-in attendee table with real-time updates via subscribeToCheckins()
- **middleware.ts** — protect `/kiosk(.*)` routes behind authentication
- **test/kiosk.test.ts** — 8 unit tests for checkinSchema and formatCheckinResult

### feat: add chat subsystem — Q&A and support channels with real-time sync

- **supabase/migrations/00007_create_chat_messages.sql** — new migration: CHAT_MESSAGES table with message_id PK, event_id FK, channel enum, user_id FK, message, sent_at, read_by, deleted_at, updated_at; index on (event_id, channel, sent_at DESC); enable Realtime publication
- **types/index.ts** — add `ChatChannel` type and `ChatMessage` interface with soft-delete support
- **modules/chat/index.ts** — domain logic: `chatChannelEnum`, `sendMessageSchema` with 1-1000 char validation, `isRateLimited()` checker, `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX` constants
- **lib/realtime/index.ts** — `subscribeToChatMessages()` utility wrapping Supabase Realtime channel with per-event, per-channel filtered INSERT subscription; client-side channel filter ensures only matching channel messages appear
- **app/api/chat/[eventId]/route.ts** — GET (all authenticated) returns paginated messages (cursor-based, 50 per page, filtered by channel, excluding soft-deleted); POST (all authenticated) sends message with rate limiting (5/10s per user per channel) and draft-event access control
- **app/api/chat/[eventId]/[messageId]/route.ts** — DELETE (facilitator-only) soft-deletes message by setting deleted_at
- **components/chat-panel.tsx** — reusable chat UI component: message list with auto-scroll-to-bottom (respects manual scroll-up), load-more pagination, message input with send, delete button for facilitators, real-time subscription for new messages
- **app/events/[id]/support/page.tsx** — standalone support channel page scoped to channel=support
- **app/events/[id]/live/page.tsx** — replace Q&A and support chat placeholders with live ChatPanel instances; track currentUserId for client-side use
- **test/chat.test.ts** — 15 unit tests for ChatChannel type, ChatMessage type, chatChannelEnum, sendMessageSchema, and isRateLimited

### feat: add live session room with real-time lesson broadcast

- **supabase/migrations/00006_create_live_session_state.sql** — new migration: LIVE_SESSION_STATE table (event_id PK/FK, current_lesson_id FK nullable, updated_by FK, updated_at); enable Realtime publication
- **types/index.ts** — add `LiveSessionState` interface
- **modules/live-session/index.ts** — domain logic: `liveSessionUpdateSchema` for PATCH validation; `validateLessonBelongsToEvent` guard checking lesson is in event's course module tree
- **lib/realtime/index.ts** — `subscribeToLiveSession()` utility wrapping Supabase Realtime channel with per-event filtered subscription
- **components/lesson-viewer.tsx** — reusable lesson content renderer extracted from course viewer (pdf/video/image/link)
- **app/api/live/[eventId]/route.ts** — GET (all roles) returns current session state; PATCH (speaker/facilitator) updates current_lesson_id with server-side validation
- **app/api/live/[eventId]/state/route.ts** — POST (facilitator-only) initialize or reset session state
- **app/api/auth/me/route.ts** — new endpoint returning current user's `user_id` and `role` for client-side role detection
- **app/events/[id]/live/page.tsx** — live room page with speaker controls (prev/next/dropdown), attendee lesson viewer, Q&A placeholder, support chat placeholder; real-time sync via Supabase Realtime with 10s polling fallback

### feat: add event status lifecycle (draft → active → complete)

- **supabase/migrations/00004_create_commerce.sql** — merge price/currency ALTER TABLE from `docs/update_table_include_price.sql` into PAYMENTS table; add amount/currency columns and CHECK constraints
- **supabase/migrations/00005_create_event_status.sql** — new migration: `event_status` enum, `status` column on EVENTS (default `draft`), index
- **types/index.ts** — add `EventStatus` type, `status` field to Event interface
- **modules/event-management/index.ts** — add `status` (enum optional) to eventBaseSchema
- **app/api/events/route.ts** — POST inserts with `status: "draft"`; GET filters out `draft` events for non-facilitators
- **app/api/events/[id]/route.ts** — GET returns 404 on `draft` for non-facilitators
- **app/api/events/[id]/publish/route.ts** — new endpoint: facilitator-only `draft → active` transition
- **app/api/events/[id]/register/route.ts** — GET and POST reject draft events for non-facilitators (defense in depth)
- **app/api/payments/route.ts** — POST rejects draft events (defense in depth)
- **app/events/[id]/page.tsx** — show status badge; show "Publish" button when draft with optimistic UI update
- **app/events/[id]/edit/page.tsx** — add status select dropdown (draft/active/complete)
- **context/OVERVIEW.md** — add `status ENUM(draft,active,complete)` to EVENTS row
- **context/data-model.md** — add status field, event_status enum, validation rules, index
- **context/functional-planning.md** — add facilitator stories for publish/complete; add draft visibility to permission matrix; add business rules 9–14 for event status
- **context/architecture.md** — note status in Event Management module
- **context/scope.md** — mention draft→active→complete lifecycle
- **context/ux-screens.md** — add status field to form requirements; add publish action to Event Detail permissions
- **context/spec/03-event-management-spec.md** — add status column, publish endpoint, draft filtering, lifecycle rules
- **test/event-management.test.ts** — add `status` to Event interface test; add schema tests for valid/invalid status values

### fix: Zod 4 forbids .partial() on schemas with .refine() — split eventSchema into base + partial

- **modules/event-management/index.ts** — extract `eventBaseSchema` (no refine) and derive `eventPartialSchema` (partial of base) from it, so PATCH handler avoids calling `.partial()` on a refined schema
- **app/api/events/[id]/route.ts** — import and use `eventPartialSchema` instead of `eventSchema.partial()`

### feat: add price/currency fields to event create/edit forms

- **modules/event-management/index.ts** — remove `.default()` from `price`/`currency` in eventSchema so PATCH doesn't silently overwrite omitted fields; fallback defaults applied at POST handler and DB level
- **app/api/events/route.ts** — include `price`/`currency` in the POST insert mapping (defaulting to 0 and "PHP")
- **app/events/new/page.tsx** — add Price (number, min 0) and Currency (uppercased 3-char) inputs
- **app/events/[id]/edit/page.tsx** — load and save price/currency; add Price and Currency inputs

### docs: reflect event pricing fields across all planning documents

- **OVERVIEW.md** — add `price`/`currency` to EVENTS row, `amount`/`currency` to PAYMENTS row, pricing model note (amount snapshotted from event at creation)
- **data-model.md** — EVENTS and PAYMENTS entity specs with `price`/`amount`/`currency` fields and CHECK constraints; add 4 pricing validation rules
- **scope.md** — facilitator role includes pricing; event management workflow mentions price; success criteria updated
- **functional-planning.md** — add facilitator story for setting price/currency; add "Set event price/currency" to permission matrix; add business rules 7-8 for price non-negativity and amount snapshot
- **architecture.md** — note price/currency on EVENTS module and amount/currency on PAYMENTS module
- **ux-screens.md** — add Price and Currency fields to Event Create/Edit form; update Payment Status per-role actions to include amount

### fix: snapshot event price/currency into payments instead of hardcoding 0/SGD

- **types/index.ts** — add `price`/`currency` to Event, `amount`/`currency` to Payment
- **modules/event-management/index.ts** — add `price` (min 0) and `currency` (3-char, default PHP) to eventSchema
- **app/api/payments/route.ts** — fetch `EVENTS.price`/`currency` at payment creation; snapshot into `PAYMENTS.amount`/`currency` on insert; pass actual amount/currency to HitPay
- **app/api/events/[id]/register/route.ts** — include `price`/`currency` in registration data response
- **context/spec/04-commerce-spec.md** — add pricing note documenting the snapshot behavior
- **test/event-management.test.ts** — update Event interface test to include `price`/`currency`

### feat: add commerce pipeline — HitPay payments, tickets, QR codes

- **supabase/migrations/00004_create_commerce.sql** — PAYMENTS and TICKETS tables with status enums, FK constraints, and indexes
- **types/index.ts** — add Payment, Ticket, PaymentStatus, TicketStatus interfaces
- **modules/commerce/index.ts** — paymentInitSchema, status transition guards, QR token generation, terminal state check
- **lib/hitpay/index.ts** — HitPay API client (createPayment, verifyWebhookSignature with HMAC)
- **lib/qr/index.ts** — QR code generation as data URL via `qrcode` package
- **app/api/payments/route.ts** — POST initiate payment (creates PAYMENTS record, returns HitPay checkout URL); GET list payments (attendee: own; facilitator: all)
- **app/api/payments/[id]/route.ts** — GET payment status with role-based access
- **app/api/payments/webhook/route.ts** — POST HitPay webhook receiver (HMAC validation, idempotent, issues ticket on paid)
- **app/api/tickets/route.ts** — GET list tickets with event details
- **app/api/tickets/[paymentId]/route.ts** — GET ticket with QR data URL
- **app/api/events/[id]/register/route.ts** — GET registration page data; POST validate eligibility + duplicate check
- **app/events/[id]/register/page.tsx** — registration page with terms agreement and payment redirect
- **app/checkout/[paymentId]/page.tsx** — checkout status page polling payment until resolution
- **app/tickets/page.tsx** — attendee ticket wallet with QR code display
- **app/payments/page.tsx** — payment status list (attendee: own; facilitator: all)
- **middleware.ts** — exclude `/api/payments/webhook` from auth protection (public endpoint)
- **package.json** — add `qrcode` and `@types/qrcode` dependencies
- **.env.local** — add HitPay sandbox configuration variables
- **test/commerce.test.ts** — 24 unit tests for types, schemas, status transitions, token generation

### fix: repair speaker assignment page and public event API access

- **middleware.ts** — exclude `/api/events` and `/api/speakers` from auth protection; public GET routes handled at route level
- **app/api/speakers/route.ts** — add explicit `requireRole("facilitator")` to GET handler (previously relied on middleware)
- **app/api/events/[id]/speakers/route.ts** — add `requireRole("facilitator")` to GET handler
- **app/events/[id]/speakers/page.tsx** — fix `loadAll()` reference error (function inlined during lint fix lost the name); use refresh-key pattern to avoid lint warnings

### feat: add event management and speaker assignment

- **supabase/migrations/00003_create_event_management.sql** — EVENTS, SPEAKER_PROFILES, EVENT_SPEAKERS tables with CHECK constraint, indexes, and cascade rules
- **types/index.ts** — add Event and SpeakerProfile interfaces
- **modules/event-management/index.ts** — Zod schemas for events, speaker profiles, and speaker assignments
- **app/api/events/** — CRUD routes with facilitator guards, event delete checks for existing payments
- **app/api/speakers/** — list/create speaker profiles (facilitator); PATCH allows self-service edit
- **app/api/events/[id]/speakers/** — assign/remove speakers from events
- **app/events/** — public event list (filterable by upcoming/past), event detail page, create/edit forms
- **app/speakers/** — speaker profile list, edit page
- **app/events/[id]/speakers/** — speaker assignment UI (assign/remove)
- **test/event-management.test.ts** — 14 unit tests for schemas and type shapes

### feat: add missing course content screens (module editor, lesson viewer, progress)

- **app/courses/[...]/modules/[...]/page.tsx** — module/lesson editor with create, edit, delete for lessons
- **app/courses/[...]/lessons/[...]/page.tsx** — lesson viewer rendering pdf/video/image/link content with progress tracking
- **app/courses/[...]/progress/page.tsx** — progress overview table (facilitator: all attendees; attendee: own)

### feat: add auth foundation — Clerk, Supabase, shadcn/ui, role guards

- **middleware.ts** — clerkMiddleware enforcing authentication on all protected routes; role checks deferred to API route guards
- **lib/db/index.ts** — Supabase typed client with anonymous and service-role clients
- **lib/auth/role-guard.ts** — `requireRole(...)` helper for API routes and server components
- **types/index.ts** — shared `User` and `UserRole` TypeScript interfaces
- **app/api/auth/route.ts** — Clerk webhook endpoint syncing user.created/updated/deleted to `USERS` table
- **app/layout.tsx** — wrap root with `<ClerkProvider>`
- **app/sign-in/** and **app/sign-up/** — Clerk-hosted auth pages
- **app/dashboard/** — facilitator-only page with role guard returning 403 for non-facilitators
- **supabase/migrations/00001_create_users.sql** — USERS table migration with role enum, indexes, and audit fields
- **components/ui/** — shadcn/ui primitives: button, input, card, label, select, dialog, form
- **test/foundation.test.ts** — unit tests for role guard and User type shape
- **package.json** — add @clerk/nextjs, @supabase/supabase-js, svix, react-hook-form, @hookform/resolvers, zod

### chore: resolve spec gaps before implementation handoff

- **AGENTS.md** — add vitest testing instructions
- **context/architecture.md** — document Supabase Realtime per-table setup requirement
- **context/spec/01-foundation-spec.md** — middleware now auth-only (role checks deferred to API route guards); add Realtime config to foundation scope
- **context/spec/05-live-session-spec.md** — add Realtime prerequisite on `LIVE_SESSION_STATE`
- **context/spec/06-chat-spec.md** — add Realtime prerequisite on `CHAT_MESSAGES`
- **context/spec/07-kiosk-spec.md** — add Realtime prerequisite on `TICKETS`
- **package.json** — add vitest dependency and `test` script
- **vitest.config.ts** — new file, vitest config with React plugin and `@/` alias

### docs: add planning documents (Phases 1-4)

- `a133d23` **scope.md** — MVP scope, user roles, feature boundaries, and out-of-scope items
- `69c7de7` **functional-planning.md** — user stories for every role-to-system interaction, organized by workflow
- `1863661` **architecture.md** — module ownership, module-to-entity mapping, technology choices, and key dependencies
- `c0e673c` **data-model.md** — finalized schema definitions for every entity, field types, constraints, and relationships
- `e3a865c` **ux-screens.md** — screen inventory by module, route design, role-based access, and UI mockups

### docs: tighten context files for code generation precision

- **OVERVIEW.md**: spell out `role` enum values (`attendee | speaker | facilitator`); define `LESSONS.content_type` as `ENUM(pdf, video, image, link)` with descriptions
- **phase-0.md** to **phase-8.md**: add explicit output file paths so agents write to a known location
- **phase-6.md**: fix `context/specs/` → `context/spec/` to match Phase 5's output directory
- **phase-5.md**: align `context/specs/` → `context/spec/` for consistency

### docs: add descriptions to reference files in Phase 5 build planning

- `e85ca32` **phase-5.md**: add one-line descriptions to each referenced planning document so agents can quickly identify which file to consult for scope, workflows, architecture, schema, or screens

### feat: create 9 build spec sheets for Phase 5 implementation planning

- **01-foundation-spec.md** — Auth + user/role model with Clerk, Supabase client, shadcn/ui, and role-based middleware
- **02-course-content-spec.md** — Course/Module/Lesson CRUD + progress tracking for attendees
- **03-event-management-spec.md** — Event CRUD + speaker profiles + speaker assignment
- **04-commerce-spec.md** — HitPay checkout → payment webhook → ticket/QR issuance
- **05-live-session-spec.md** — Live session state model + real-time broadcast via Supabase Realtime
- **06-chat-spec.md** — Q&A + support chat channels with real-time sync
- **07-kiosk-spec.md** — Kiosk check-in flow with QR scan/verify
- **08-surveys-spec.md** — Survey CRUD + response submission
- **09-notifications-spec.md** — Email logs + Brevo transactional send

Each spec follows the mandatory Context/Objective/Scope/Constraints/Deliverable/Acceptance Criteria format. Build order respects Phase 2 dependency order with no violations; every milestone is independently demoable.
