# SPEC-01: Role System

## Five Roles with Hierarchy

```
attendee     = 10
speaker      = 20
facilitator  = 30
admin        = 40
super_admin  = 50
```

Higher number = more privilege. A role at level N is authorized for any gate
requiring level ≤ N.

## Class grouping

- **Attendees**: attendee
- **Speakers**: speaker (content creators, not staff)
- **Staff**: facilitator, admin, super_admin (event operators)

## TypeScript type

```ts
// src/shared/types/index.ts
export type UserRole = "attendee" | "speaker" | "facilitator" | "admin" | "super_admin";
```

## Hierarchy utility

New file `src/shared/auth/role-hierarchy.ts`:

```ts
const ROLE_LEVEL: Record<UserRole, number> = {
  attendee: 10,
  speaker: 20,
  facilitator: 30,
  admin: 40,
  super_admin: 50,
};

function hasMinRole(actual: UserRole, required: UserRole): boolean;
```

## requireRole refactor

`src/modules/auth/lib/role-guard.ts` changes from exact-match:

```
user.role ∈ allowedRoles
```

to hierarchy check:

```
∃ r ∈ allowedRoles: hasMinRole(user.role, r)
```

This means:
- `requireRole("facilitator")` matches facilitator, admin, super_admin
- `requireRole("speaker")` matches speaker, facilitator, admin, super_admin
- `requireRole("attendee")` matches everyone

## API gate changes

| Route | Current | New (effective) |
|---|---|---|
| `POST /api/courses` | `facilitator` | `speaker` |
| `GET /api/courses` | `facilitator` | `speaker` |
| `POST /api/organization` | `facilitator` | `admin` |
| `PATCH /api/organization/[id]` | `facilitator` | `admin` |
| `DELETE /api/organization/[id]` | `facilitator` | `admin` |
| All other `facilitator` gates | `facilitator` | unchanged (hierarchy auto-extends) |

## UI role checks

All `user.role === "facilitator"` checks renamed to use hierarchy.
`isFacilitator` in use-event-detail updated to check `hasMinRole(role, "facilitator")`.
