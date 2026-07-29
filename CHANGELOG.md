# CHANGELOG

## [Unreleased]

### Added
- Staff management pages for events, courses, emails, and organization under `src/app/staff/`.

### Changed
- Migrated from Clerk to Supabase Auth. All auth logic centralized in `src/modules/auth/`.
- Old staff-related pages moved under `src/app/staff/` namespace; route protection updated accordingly.
- All API routes updated: `auth()` from Clerk replaced with `requireAuth()`/`requireRole()` from auth module.
- All client components updated: `useUser()`/`useClerk()` replaced with `useSession()` from auth module.
- Middleware rewritten to use `@supabase/ssr` for session management.
- Staff login page merged into unified sign-in page (role-based redirect).
