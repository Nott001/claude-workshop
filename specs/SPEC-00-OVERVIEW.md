# SPEC-00: Remediation Overview

A 6-phase plan to compile, stabilize, restructure, and shrink the live events platform codebase.

## Current State

Next.js 16 / React 19 events platform with Supabase backend. Mid-refactor toward modular monolith, stalled with:

- Broken imports (modules reference files that don't exist)
- Inconsistent layout (`components/`, `lib/`, `modules/` overlap)
- Runtime bugs (wrong DB table names, undeclared variables)
- Silent error handling (DAOs discard errors, fetcher ignores HTTP status)
- Data corruption risk (non-transactional cascades, missing `await`)

**Total `src/`:** ~13,034 lines. **Target:** ~11,000.

## Target Structure

```
src/
├── app/                              # Next.js App Router (unchanged)
│   ├── api/
│   ├── (page routes)/
│   └── layout.tsx
├── middleware.ts
├── modules/                          # Self-contained business domains
│   ├── auth/      {components/, lib/}
│   ├── audit/     {lib/}
│   ├── chat/      {components/, lib/}
│   ├── commerce/  {components/, lib/}
│   ├── courses/   {components/, lib/}
│   ├── events/    {components/, lib/}
│   ├── kiosk/     {components/, lib/}
│   ├── notifications/ {lib/}
│   ├── organization/  {lib/}
│   ├── speakers/  {lib/}
│   └── support/   {components/, lib/}
├── shared/                           # Shared across ALL modules
│   ├── components/ {ui/, app-shell, footer, navbar, toast}
│   ├── db/         {client.ts, dao/*.ts}
│   ├── integrations/ {email/, qr/, realtime/, storage/}
│   ├── lib/        {date-utils.ts, fetcher.ts, utils.ts}
│   └── types/
test/                                  # All tests (moved from src/test/)
```

## Structural Rules

1. No barrel files in `modules/`. Import exact paths only.
2. Modules own their domain (components, schemas, hooks, server logic).
3. `shared/` is for generic reusable things.
4. `modules/*/components/` holds React components specific to that module.
5. `modules/*/lib/` holds business logic (schemas, hooks, server functions, types).
6. `shared/components/ui/` holds generic primitives (button, input, dialog).
7. `shared/integrations/` holds external service wrappers.
8. `shared/db/` holds DB access layer (client + DAOs).
9. Tests live at `/test/`.
10. One DAO barrel exception: `shared/db/dao/index.ts`.

## Phase Sequence

```
Phase A: Compilation   (A1-A3)   → pnpm lint green
Phase B: Runtime       (B1-B12)  → Core logic correct
Phase C: Code Quality  (C1-C12)  → Types, errors tightened
Phase D: File Moves    (D1-D8)   → Structure matches target
Phase E: LoC Reduction (E1-E4)   → -2,000 lines target
Phase F: Polish                  → format + lint + test green
```

After each phase: `pnpm format && pnpm lint && pnpm test`.

## LoC Budget

| Issue | Change | Lines |
|-------|--------|-------|
| B11 | Split chat.dao.ts | -30 |
| B12 | Remove dead code | -50 |
| D6 | Prevent planned 15+ UI files | -500 (never written) |
| D7 | Inline landing.ts | -58 |
| D8 | Merge tiny hook files | -40 |
| E1 | Shared chat hooks | -200 |
| E2 | Button/Badge/Avatar primitives | -250 |
| E3 | DAO helper consolidation | -150 |
| E4 | Consolidate event fetch hooks | -150 |
| **Total** | | **~1,928** |
