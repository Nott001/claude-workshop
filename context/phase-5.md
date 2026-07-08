# Phase 5 — Build Planning

## Objective
Break the finalized design (Phases 0-4) into ordered, spec sheets for implementation into a file `N-<feature>-spec.md`, where N is the current spec increment and task is defined by you.
Write these files into `context/spec/`

## Required Outputs
- **Implementation phases** (build spec sheets, distinct from planning Phases 0-8): group by Phase 2 dependency order, e.g.:
  1. Auth + user/role model
  2. Course content CRUD + progress tracking
  3. Event CRUD + speaker assignment + Course
  4. Commerce: HitPay checkout → payment webhook → ticket/QR issuance
  5. Live session room: state model + real-time broadcast
  6. Chat: support + live_qa channels
  7. Kiosk check-in flow
  8. Surveys
  9. Email notifications
- **Feature-by-feature milestones**: one deliverable per milestone, each independently testable.
- **Prompt-ready tasks**: each task written in the mandatory format from OVERVIEW.md §3 (Context/Objective/Scope/Constraints/Deliverable/Acceptance Criteria) — one feature per task, no bundling.

## Constraints
- No milestone may require a module scheduled later in the build order.
- Do not generate the actual code prompts for every milestone in this phase — only the milestone list and the task-format template ready for Phase 6 use.

## Acceptance Criteria
- Build order matches Phase 2 dependency order with no violations.
- Each milestone is independently demoable (no partial/broken intermediate states required across milestones).
- Milestone list traces back to Phase 0 MVP scope with no untracked additions.
