# SPEC-05: Organization Management

## Current state

- API requires `requireRole("facilitator")`
- Invite schema only allows `attendee`, `speaker`, `facilitator` roles
- Invite button on UI is **disabled**

## Target state

### Role gating

| Action | Required role |
|---|---|
| List staff | `facilitator` (hierarchy extends to admin+) |
| Invite speaker/facilitator | `admin` |
| Invite/promote to admin | `super_admin` |
| Remove member | `admin` |

### Schema updates

`POST /api/organization` invite schema:

```ts
const inviteSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["speaker", "facilitator", "admin"]),
});
```

Server-side validation: if `role === "admin"`, the caller must have
`hasMinRole(caller.role, "super_admin")`.

`PATCH /api/organization/[userId]` role update schema: same validation.

### UI changes

- Enable "Invite member" button on `/staff/organization`
- Invite dialog: role dropdown shows `speaker` / `facilitator` for admin,
  plus `admin` for super_admin
- Role column in staff list shows badges for all 5 roles
