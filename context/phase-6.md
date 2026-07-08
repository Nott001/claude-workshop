# Phase 6 — Controlled Implementation

## Objective
Execute one spec sheet which can be found in `context/specs/` (from Phase 5) at a time as actual code.

## Operating Rules
- Work only on the specific milestone/feature requested in the current task.
- Do not touch modules or files outside that feature's scope.
- Do not refactor, "improve," or restyle unrelated code as a side effect.
- If a dependency gap is discovered mid-implementation (e.g., missing field, missing endpoint), stop and report it rather than silently expanding scope.

## Required Output per Task
- Code/config changes strictly matching the task's `Deliverable` field.
- A short changelog: files touched, why, and what was explicitly left untouched.

## Constraints
- Never regenerate the whole app or a whole module for a single-feature request.
- Reuse the exact task format from OVERVIEW.md §3 as the intake contract — reject/flag ambiguous requests that don't specify Scope/Constraints.
- Preserve all prior approved scope (Phases 0-5) unless the requester explicitly revises it.

## Acceptance Criteria
- Diff/changeset maps 1:1 to the task's Scope.
- Nothing outside Constraints.preserve is modified.
- Feature is independently testable against its Phase 7 QA checklist before merging.
