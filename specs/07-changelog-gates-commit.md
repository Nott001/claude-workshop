# 07. CHANGELOG, gates, commit

## Goal

Close the series: update CHANGELOG for the user-visible/structural change, run
the full gate suite this repo's CI enforces, smoke the isolate runtime because
realtime sockets changed, and commit on the branch.

## Run order

Last. Nothing depends on it; it verifies everything.

## Files touched

- `CHANGELOG.md`
- No source changes unless a gate fails and it is a fix for this series.

## Prerequisites

- Sheets 01–06 verified.

## Steps

1. Add a CHANGELOG entry summarising the extraction (Q/A now a submodule of
   courses; realtime hardened with a new migration; chat back to support-only).
2. Run `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm test` — the same
   gates CI enforces. Coverage thresholds are a ratchet: raise them if the
   suite measures higher, never lower them.
3. Run `pnpm cf:preview`. Only it answers "does this run in an isolate"
   (AGENTS.md), and this series changed realtime sockets in sheet 05, so the
   smoke run is required.
4. Commit with a conventional, imperative message, e.g.:
   `refactor(courses): make QA a submodule of courses`
   Body explains _why_ (Q/A split from chat, owns its table, is course-owned)
   and notes the realtime adoption and migration — per AGENTS.md, a platform
   primitive (realtime) was leaned on and that must be stated.
5. Do not push or open a PR unless asked.

## Verification

- `pnpm format && pnpm lint && pnpm typecheck && pnpm test` all green.
- `pnpm cf:preview` boots and the QA panel's fetch + subscription work.
- `git status` clean except the intended diff; CHANGELOG entry present.
- `git log -1` shows the conventional message with a why-body.

## Risks

- A gate failure here means a prior sheet missed a verification step — fix the
  root cause in the owning sheet's spirit; do not paper over it.
