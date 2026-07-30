# SPEC-01-A — Navbar + Post-Login Redirect

Prerequisites: none
After this: SPEC-01-B

## Scope

2 files. Pure config-map changes. No page-level guards, no API changes.

## Changes

### 1. `src/shared/components/navbar.tsx`

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
