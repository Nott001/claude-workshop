# CHANGELOG

## [Unreleased]

### Security
- Course material is no longer readable by any signed-in user. `/api/storage/[bucket]/[...path]` read any bucket and object key straight from the URL using the service client, bypassing row level security — paid course videos and assets were available to anyone with an account. Access now requires a live ticket to the event teaching the course, a speaker assignment to it, or the facilitator role.
- Storage requests are answered `Cache-Control: private`. Entitlement is per user, and the previous `public` response could be served from a shared cache to someone not entitled to it.

### Fixed
- QR check-in works again. Every scan returned "Invalid QR token" because the ticket lookup joined the user through the wrong column, so the query errored and the ticket was reported as missing.
- Chat message senders, the event attendee list, and email log recipients load again — all four affected queries shared the same fault.
- Course pages load again. Three modules deleted during an earlier refactor left their importers behind, which broke the production build outright.

### Added
- Staff management pages for events, courses, emails, and organization under `src/app/staff/`.

### Changed
- Migrated from Clerk to Supabase Auth. All auth logic centralized in `src/modules/auth/`.
- Old staff-related pages moved under `src/app/staff/` namespace; route protection updated accordingly.
- All API routes updated: `auth()` from Clerk replaced with `requireAuth()`/`requireRole()` from auth module.
- All client components updated: `useUser()`/`useClerk()` replaced with `useSession()` from auth module.
- Middleware rewritten to use `@supabase/ssr` for session management.
- Staff login page merged into unified sign-in page (role-based redirect).
