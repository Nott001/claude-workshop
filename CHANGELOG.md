# CHANGELOG

## [Unreleased]

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
