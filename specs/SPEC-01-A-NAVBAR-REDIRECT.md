# SPEC-01-A — Navbar + Post-Login Redirect

Prerequisites: SPEC-00
After this: SPEC-01-B

## Scope

2 files. Pure config-map changes. No page-level guards, no API changes.

## Changes

### 0. `src/shared/components/navbar.tsx` — fix fallback (line 73)

Before making any nav item changes, fix the dangerous fallback on line 73:

```ts
// Before:
const navItems = isSignedIn ? (ROLE_NAV_ITEMS[userRole] ?? ROLE_NAV_ITEMS.facilitator!) : GUEST_NAV_ITEMS;
// After:
const navItems = isSignedIn ? (ROLE_NAV_ITEMS[userRole] ?? ROLE_NAV_ITEMS.attendee!) : GUEST_NAV_ITEMS;
```

If a user has an unrecognised role (DB corruption, new role not yet mapped),
the current code falls back to `facilitator` nav — the worst default. Fall
back to `attendee` (least privilege) instead.

### 1. `src/shared/components/navbar.tsx` — role nav items

Modify the `ROLE_NAV_ITEMS` map:

| Role        | Current items                                                            | New items          |
| ----------- | ------------------------------------------------------------------------ | ------------------ |
| speaker     | Dashboard, Events → `/staff/events`                                      | **Dashboard** only |
| facilitator | Events, Create event, Organization, Emails, Support, Audit Logs          | **Events** only    |
| admin       | Events, Create event, Courses, Organization, Emails, Support, Audit Logs | (unchanged)        |
| super_admin | Events, Create event, Courses, Organization, Emails, Support, Audit Logs | (unchanged)        |
| attendee    | Home, Events, Tickets                                                    | (unchanged)        |

Remove `Events` from the speaker entry. Remove `Create event`, `Organization`, `Emails`, `Support`, `Audit Logs` from the facilitator entry. Guest and attendee entries are unchanged.

### 2. `src/modules/auth/components/post-login-redirect.tsx`

Add two entries to `ROLE_HOME`:

```
admin: "/staff/events"
super_admin: "/staff/events"
```

## Verification

- Sign in as `speaker` → nav shows only Dashboard; redirected to `/speaker/dashboard` after sign-in.
- Sign in as `facilitator` → nav shows only Events; redirected to `/staff/events`.
- Sign in as `admin` → nav shows all admin items; redirected to `/staff/events`.
- Sign in as `super_admin` → same as admin.
- Sign in as `attendee` → unchanged.
