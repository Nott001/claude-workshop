# Build Phase 1 — Foundation: Auth + User/Role Model

## Context

The project requires role-based access control (attendee, speaker, facilitator) integrated with Clerk for authentication. Every subsequent module depends on a functioning auth layer: API routes must verify the user's identity and role before processing requests, and the UI must protect screens by role. The database USERS table must be kept in sync with Clerk's user directory via webhook.

## Objective

Stand up the authentication foundation: Clerk integration, Supabase client, role-based middleware, shadcn/ui component library, and the user table sync pipeline so that all later modules can assume a working auth layer.

## Scope

- Clerk SDK installed and configured (`@clerk/nextjs`)
- `middleware.ts` enforcing authentication only (redirect unauthenticated users to sign-in); role checks are handled by `lib/auth/` API route guards
- Supabase typed client (`lib/db/`) initialized
- `USERS` table migration (with all fields from data model)
- Clerk webhook endpoint (`/api/auth`) that syncs `clerkId`, `email`, `full_name` to `USERS` on create/update/delete
- shadcn/ui initialized with a baseline set of primitives (button, input, card, label, select, dialog, form)
- Tailwind CSS v4 config verified
- `lib/auth/` role guard helper (`requireRole('facilitator')`, etc.) for API routes
- Root layout wraps app with `<ClerkProvider>`
- `/sign-in` and `/sign-up` routes (Clerk-hosted)
- `/dashboard` placeholder page with facilitator-only guard
- `types/` directory with shared TS interfaces mirroring the USERS schema
- Supabase Realtime enabled on `LIVE_SESSION_STATE`, `CHAT_MESSAGES`, and `TICKETS` tables (Supabase Dashboard → Database → Replication)

## Constraints

- Do not modify or delete any existing files outside of the specified scope
- Clerk webhook secret must be read from env, never hardcoded
- Supabase client must use the `@supabase/supabase-js` typed client, not raw queries
- Role enum must match `attendee | speaker | facilitator` exactly

## Deliverable

- Verified login/signup flow via Clerk
- Created user appears in `USERS` table via webhook
- `/dashboard` returns 403 for non-facilitator roles
- All listed files exist at their specified paths

## Acceptance Criteria

- [ ] New Clerk sign-up creates a row in `USERS` within 5 seconds
- [ ] `/dashboard` redirects unauthenticated users to `/sign-in`
- [ ] `/dashboard` shows "Access denied" for `attendee` and `speaker` roles
- [ ] `middleware.ts` correctly blocks unauthenticated requests to all protected routes
- [ ] shadcn/ui `Button` renders correctly in a test page
