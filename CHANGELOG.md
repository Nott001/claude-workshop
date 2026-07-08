# CHANGELOG

## [Unreleased]

### docs: add planning documents (Phases 1-4)

- `a133d23` **scope.md** — MVP scope, user roles, feature boundaries, and out-of-scope items
- `69c7de7` **functional-planning.md** — user stories for every role-to-system interaction, organized by workflow
- `1863661` **architecture.md** — module ownership, module-to-entity mapping, technology choices, and key dependencies
- `c0e673c` **data-model.md** — finalized schema definitions for every entity, field types, constraints, and relationships
- `e3a865c` **ux-screens.md** — screen inventory by module, route design, role-based access, and UI mockups

### docs: tighten context files for code generation precision

- **OVERVIEW.md**: spell out `role` enum values (`attendee | speaker | facilitator`); define `LESSONS.content_type` as `ENUM(pdf, video, image, link)` with descriptions
- **phase-0.md** to **phase-8.md**: add explicit output file paths so agents write to a known location
- **phase-6.md**: fix `context/specs/` → `context/spec/` to match Phase 5's output directory
- **phase-5.md**: align `context/specs/` → `context/spec/` for consistency

### docs: add descriptions to reference files in Phase 5 build planning

- `e85ca32` **phase-5.md**: add one-line descriptions to each referenced planning document so agents can quickly identify which file to consult for scope, workflows, architecture, schema, or screens
