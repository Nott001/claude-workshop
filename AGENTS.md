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
- `pnpm test` runs once and exits. Use `pnpm test:watch` while iterating.
- **Assert on behaviour, not on type shapes.** A test that builds an object literal and asserts on that same literal executes no product code — TypeScript already checks the shape. Call the real function.
- Coverage thresholds in `vitest.config.ts` are a ratchet. Raise them when you raise coverage; never lower them to make a build pass.
- See `specs/SPEC-07-TEST-STRATEGY.md` for the current gaps and priorities.

## Commits and PRs

- Use the **imperative mood**. Use conventional commit prefixes (`fix:`, `feat:`, `chore:`, `docs:`, `refactor:`, etc.).
- The commit body should explain why the change was made, never what it is.
- Always run `pnpm format`, `pnpm lint`, `pnpm typecheck` and `pnpm test` before committing. These are the same gates CI enforces.
- Update `CHANGELOG.md` only for meaningful commits. Filter for commits that affect user-facing features, bug fixes, or breaking changes. Skip internal refactors, documentation tweaks, or minor code cleanup unless they're significant.
- If the changes are huge enough on different commits.

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
