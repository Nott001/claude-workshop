# Agent Instructions

## Development

- Always use `pnpm dev` while iterating on the application. This starts Next.js in development mode with hot-reload enabled.
- Never use `pnpm build`.
- Keep modules **small** and **single-purpose**.
- **Fix root causes**. Do not layer workarounds.
- **Comment sparingly**. The code should be able to describe what it's doing and the comment should say why. If the code is not clear and reasoning is non-obvious, then add a comment.
- If you add or update a dependency, update the appropriate lockfile. Restart the development server so that Next.js reflects changes.
- Create a new branch when tasked to write changes. Keep branch names short and concise.

## Testing

- Testing is done using **vitest**. Ensure that all tests are created in the `test` directory. Make one if it doesn't exist.
- Add or update tests for the code you change, even if nobody asked.
- Update `vitest.config.ts` if other depencies necessitate it.

## Commits and PRs

- Use the **imperative mood**. Use conventional commit prefixes (`fix:`, `feat:`, `chore:`, `docs:`, `refactor:`, etc.).
- The commit body should explain why the change was made, never what it is.
- Always run `pnpm format`, `pnpm lint` and `pnpm test` before committing.
- Update the `CHANGELOG.md` for every commit. If one does not exist, create one.
- If the changes are huge enough, separate them out depending on the scope.

## Debug Menu

The debug menu (`components/debug-menu.tsx`) is a temporary testing tool that bypasses authentication and allows role switching. It must be updated when adding new pages and completely removed before production.

### When adding new pages

- Add the page route to `NAV_ITEMS` (public routes) or the appropriate role array in `ROLE_NAV_ITEMS` in `components/debug-menu.tsx`.
- If the page is protected, also add the route pattern to the `isProtectedRoute` array in `middleware.ts` and update `lib/auth/role-guard.ts` if role-based access is needed.

### Before production

Follow the instructions in `DEBUG-REMOVAL.md` to remove the debug menu entirely. This includes:
1. Deleting `components/debug-menu.tsx`
2. Removing imports and usage from `app/layout.tsx`
3. Removing debug bypass logic from `middleware.ts`
4. Removing debug bypass logic from `lib/auth/role-guard.ts`
5. Deleting `DEBUG-REMOVAL.md`

## Boundaries

- **Ask first**
  - Large refactors.
  - New dependencies with broad impact.
  - Destructive data or migration changes.

- **Never**
  - Commit secrets, creditentials, or tokens.
  - Use destructive git operations unless explicitly requested.
