# Phase 6 — Controlled Implementation via Spec sheets

## Objective
Implement one spec sheet, which can be found in `context/spec/` (from Phase 5), at a time. Ensure that you've read [AGENTS.md] for guidelines and guardrails.

## Operating Rules
- Work only on the specific milestone/feature requested in the current task.
- Do not touch modules or files outside that feature's scope.
- Do not refactor, "improve," or restyle unrelated code as a side effect.
- If a dependency gap is discovered mid-implementation (e.g., missing field, missing endpoint), report it and continue. Do not silently expand scope without permission.

## Required Output per Task
- Code/config changes strictly matching the task's `Deliverable` field.
- Update CHANGELOG.md: files touched and why was made.

## Constraints
- Never regenerate the whole app or a whole module for a single-feature request.
- Reuse the exact task format from OVERVIEW.md as the intake contract — reject/flag ambiguous requests that don't specify Scope/Constraints.
- Preserve all prior approved scope (Phases 0-5) unless the requester explicitly revises it.

## Acceptance Criteria
- Diff/changeset maps 1:1 to the task's Scope.
- Nothing outside Constraints.preserve is modified.
- Feature is independently testable against its Phase 7 QA checklist before merging.
