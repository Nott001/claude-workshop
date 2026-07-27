# SPEC-06: Phase F — Polish

Goal: `pnpm format`, `pnpm lint`, `pnpm test` all green + delete stale directories.

---

## F1. Run Format

```bash
pnpm format
```

Fix any formatting issues across all modified files.

---

## F2. Run Lint

```bash
pnpm lint
```

Fix all lint errors. Common issues to address:
- Unused imports in files with inline stubs
- Unused variables in moved components
- Missing `"use client"` directives in new hooks
- Type errors from restructured types

---

## F3. Run Tests

```bash
pnpm test
```

Ensure all tests pass after the restructure. Common issues:
- Import path updates needed in test files
- Type mismatches from `ChatChannel`, `ChatMessage` type changes
- Mock updates for new helper functions

---

## F4. Delete Stale Directories

After verifying everything passes:

- `src/components/`
- `src/lib/`
- `src/types/`
- `src/test/`
- `src/hooks/` (if still exists and empty)
- `src/modules/event-management/` (replaced by `src/modules/events/`)
- `src/modules/course-content/` (replaced by `src/modules/courses/`)

---

## F5. Delete Monolithic Spec

After all 6 spec files are in place:

```bash
rm REMEDIATION-SPEC.md
```

---

## F6. Smoke Test Dev Server

```bash
pnpm dev
```

Load key pages to verify the app starts without errors:
- `/` (landing)
- `/events` (event list)
- `/events/[id]` (event detail)
- `/api/auth/me` (auth endpoint)
- `/api/events` (events endpoint)
