# CHANGELOG

## [Unreleased]

### Changed
- Migrated from Clerk to Supabase Auth. All auth logic centralized in `src/modules/auth/`.
- All API routes updated: `auth()` from Clerk replaced with `requireAuth()`/`requireRole()` from auth module.
- All client components updated: `useUser()`/`useClerk()` replaced with `useSession()` from auth module.
- Middleware rewritten to use `@supabase/ssr` for session management.
- Staff login page merged into unified sign-in page (role-based redirect).
