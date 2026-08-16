# 14 — Docs, SMTP guides, and gates

## Goal

Land the reset/email effort's knowledge where future developers will find it,
and make CI + local gates agree on what "done" means. Documentation covers the
local capture box, the SMTP security model, and the deployment env matrix.

## Where

- `docs/LOCAL_DB.md` — Auth/email section: inbucket capture UI 54324, SMTP
  inbound 54325, GoTrue's docker-alias 1025, auto-route for `next dev`,
  dev-link handover as a fallback.
- `docs/DEPLOYMENT.md` — env-files table (.env / .env.remote / .env.local /
  .dev.vars), the seam paragraph (spec 04), `resizeImage` note.
- `CHANGELOG.md` — user-facing entries (auto-captured dev mail, honest reset
  statuses, forgotten-password link, rotation clarity).
- `git` — conventional prefixes, imperative mood, why-not-what commit bodies.

## Why

- "A seam is not a test." Reading that a transport can be swapped is not the
  same as knowing the swap is needed: only `pnpm cf:preview` runs in an
  isolate. The docs must say explicitly that next-dev+tests run fine while
  shipping SMTP to workerd is unproven until previewed.
- AGENTS.md binds `pnpm format` → `pnpm lint` (`--max-warnings=16`, currently
  at limit) → `pnpm typecheck` → `pnpm test` before commit; CI enforces the
  same. Coverage thresholds in `vitest.config.ts` are a ratchet — raise,
  never lower.
- The 553-envelope-sender lesson (spec 06) and the one_time_tokens rotation
  fact (spec 12) each earned exactly one lasting doc mention: they solve
  future 30-minute mysteries.

## Steps

1. Update `docs/LOCAL_DB.md` with the capture-box table (UI, inbound, alias,
   app auto-route).
2. Update `docs/DEPLOYMENT.md` env matrix with SMTP_SECURE semantics (spec 03)
   and the local/remote overlay (spec 13).
3. Add CHANGELOG entries for the user-facing fixes shipped in the four
   commits (`227edf2`, `870fdd3`, and the earlier reset-truthful/envelope work
   on `5a…`/`d3bdf74` history) with a brief why.
4. Run the full gate chain; fix anything flagged; keep coverage thresholds.

## Verify

- `pnpm format && pnpm lint && pnpm typecheck && pnpm test` all exit 0.
- `rg` the docs for each claimed port/flag so a copy-paste error in the docs
  does not become a wrong instruction.
