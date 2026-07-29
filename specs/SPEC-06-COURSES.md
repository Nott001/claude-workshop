# SPEC-06: Course Access

## Current state

All course API routes require `requireRole("facilitator")`.

## Target state

Speakers need to create and manage courses (per role spec). Course access
opens to speaker+ (level ≥ 20).

### Route changes

| Route | Current gate | New gate | Effective access |
|---|---|---|---|
| `GET /api/courses` | `facilitator` | `speaker` | speaker, facilitator, admin, super_admin |
| `POST /api/courses` | `facilitator` | `speaker` | speaker, facilitator, admin, super_admin |
| `GET /api/courses/[id]` | `facilitator` | `speaker` | speaker, facilitator, admin, super_admin |
| `PATCH /api/courses/[id]` | `facilitator` | `speaker` | speaker, facilitator, admin, super_admin |
| `DELETE /api/courses/[id]` | `facilitator` | `speaker` | speaker, facilitator, admin, super_admin |
| All module/lesson routes | `facilitator` | `speaker` | speaker, facilitator, admin, super_admin |

### Rationale

Speakers are content creators (build courses). Facilitators can view courses.
With hierarchy (`speaker=20 < facilitator=30`), using `requireRole("speaker")`
allows both groups while properly excluding attendees (10).
