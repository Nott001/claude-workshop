# Agent Instructions

## Development

- Always use `pnpm dev` while iterating on the application. This starts Next.js in development mode with hot-reload enabled.
- Never use `pnpm build`.
- Keep modules **small** and **single-purpose**.
- **Fix root causes**. Do not layer workarounds.
- **Comment sparingly**. The code should be able to describe what it's doing and the comment should say why. If the code is not clear and reasoning is non-obvious, then add a comment.
- If you add or update a dependency, update the appropriate lockfile. Restart the development server so that Next.js reflects changes.
- Create a new branch when tasked to write changes. Keep branch names short and concise.
- **Never edit an existing migration script.** Always create a new numbered migration for schema changes.

## Testing

- Testing is done using **vitest**. Ensure that all tests are created in the `test` directory. Make one if it doesn't exist.
- Add or update tests for the code you change, even if nobody asked.
- Update `vitest.config.ts` if other depencies necessitate it.

## Commits and PRs

- Use the **imperative mood**. Use conventional commit prefixes (`fix:`, `feat:`, `chore:`, `docs:`, `refactor:`, etc.).
- The commit body should explain why the change was made, never what it is.
- Update `CHANELOG.md` only for meaningful commits. Filter for commits that affect user-facing features, bug fixes, or breaking changes. Skip internal refactors, documentation tweaks, or minor code cleanup unless they're significant.

## Debug tools

- **Session bypass** — Add `?debug_bypass_session=true` to the event detail page URL to enter the session room without a ticket.

## Boundaries

- **Ask first**
  - Large refactors.
  - New dependencies with broad impact.
  - Destructive data or migration changes.

- **Never**
  - Commit secrets, creditentials, or tokens.
  - Use destructive git operations unless explicitly requested.
