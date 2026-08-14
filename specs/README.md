# QA extraction into courses — run spec

Each file in this directory is one spec sheet. They are **run sequentially**, in
filename order: `01` must be complete and verified before `02` starts, and so on.

Every sheet has the same shape: goal, run order, files touched, prerequisites,
steps, verification (definition of done) and risks. Do not skip the verification
section of a sheet — the next sheet depends on it.

Q/A software has nothing to do with support chat anymore: it owns its own
`QA_MESSAGE` table and hangs off courses as `module_type='qa'` modules. This
series finishes the extraction by moving all Q/A code into `src/modules/courses/qa/`
(a submodule of courses), gives it a course-owned realtime seam, hardens the
schema grants that seam needs, and prunes the chat module back to support-only.
The `/api/qa/*` HTTP surface is kept: Next.js requires route handlers to live
under `src/app/api`, so those files stay put and become thin handlers over the
new submodule.

| #   | Sheet                                                           | What it produces                                                     |
| --- | --------------------------------------------------------------- | -------------------------------------------------------------------- |
| 01  | [`01-shared-helpers`](01-shared-helpers.md)                     | Branch created; shared helpers neutralised                           |
| 02  | [`02-qa-module-data-layer`](02-qa-module-data-layer.md)         | courses/qa owns dao, schemas, types, realtime seam; routes repointed |
| 03  | [`03-qa-realtime-migration`](03-qa-realtime-migration.md)       | `00003` hardens realtime grants/policy; migration tests updated      |
| 04  | [`04-qa-route-orchestration`](04-qa-route-orchestration.md)     | Route logic folded into `courses/qa/lib/service.ts`; routes thin     |
| 05  | [`05-qa-panel-adopts-realtime`](05-qa-panel-adopts-realtime.md) | QAPanel → courses/qa, subscribes via its own realtime seam           |
| 06  | [`06-prune-chat-to-support`](06-prune-chat-to-support.md)       | 410 stubs removed; chat module contains only support code            |
| 07  | [`07-changelog-gates-commit`](07-changelog-gates-commit.md)     | CHANGELOG entry, all gates green, commit on branch                   |
| 08  | [`08-qa-realtime-emission`](08-qa-realtime-emission.md)         | `00004` policy helper fixes QA_MESSAGE realtime delivery             |
| 09  | [`09-live-lock-propagation`](09-live-lock-propagation.md)       | Lock toggle updates live for everyone; the full-page reload is gone  |
