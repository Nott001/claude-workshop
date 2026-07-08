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

- Add or update tests for the code you change, even if nobody asked.

## Commits and PRs

- Use the **imperative mood**. Use conventional commit prefixes (`fix:`, `feat:`, `chore:`, `docs:`, `refactor:`, etc.).
- The commit body should explain why the change was made, never what it is.
- Always run `pnpm format`, `pnpm lint` and `pnpm test` before committing.
- Update the `CHANGELOG.md` for every commit. If one does not exist, create one.
- If the changes are huge enough, separate them out depending on the scope.

## Boundaries

- **Ask first**
  - Large refactors.
  - New dependencies with broad impact.
  - Destructive data or migration changes.

- **Never**
  - Commit secrets, creditentials, or tokens.
  - Use destructive git operations unless explicitly requested.
