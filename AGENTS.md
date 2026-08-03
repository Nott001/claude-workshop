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
- **An embedded PostgREST select needs grants on every table it touches**, under the role the calling client uses. A missing grant fails the _whole_ query with `42501` and returns no rows at all, not partial ones — the landing page shipped empty this way, because it reads as anon and its `COURSE` embed was granted only to `authenticated`. Check the grants for the client you are actually using before adding an embed.

## Deployment

- The target is **Cloudflare Workers** — V8 isolates, not Node. Native addons cannot load there, so `sharp` and anything else shipping a `.node` binary is unusable. Reach for WebAssembly or a hosted service instead.
- **Keep host-specific code behind a seam.** Codecs, caches, schedulers and realtime all differ per platform. Hide them behind a signature that does not, so changing host touches one file rather than every call site. `optimizeImage` is the reference: three upload routes never learn whether sharp or photon is underneath, which is why swapping them costs minutes.
- Adopting a platform primitive (Durable Objects, KV, Cron Triggers) welds the app to that platform. Do it when it is genuinely the right tool, not by default — and say so in the commit body.

## Testing

- Testing is done using **vitest**. Ensure that all tests are created in the `test` directory. Make one if it doesn't exist.
- Add or update tests for the code you change, even if nobody asked.
- Update `vitest.config.ts` if other dependencies necessitate it.
- `pnpm test` runs once and exits. Use `pnpm test:watch` while iterating.
- **Assert on behavior, not on type shapes.** A test that builds an object literal and asserts on that same literal executes no product code — TypeScript already checks the shape. Call the real function.
- Coverage thresholds in `vitest.config.ts` are a ratchet. Raise them when you raise coverage; never lower them to make a build pass.
- See `specs/SPEC-09-TEST-STRATEGY.md` for the current gaps and priorities.

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
  - Commit secrets, credentials, or tokens.
  - Use destructive git operations unless explicitly requested.
