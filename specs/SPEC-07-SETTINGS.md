# SPEC-07: User Settings (/user/)

## Current state

`/user/[[...rest]]/page.tsx` has four card sections:
1. Profile photo upload
2. Profile name edit
3. Email change
4. Password change

Speaker update-info at `/speakers/update-info/` has:
1. Professional role (designation)
2. Password update

## Target state

Merge speaker-specific fields into the shared `/user/` page. Add a fifth card
section for speakers:

### New section: Professional Info (speaker+)

```
┌─────────────────────────────────────┐
│ Professional Info         (speaker+) │
├─────────────────────────────────────┤
│ Designation:  [_________________]  │
│ Bio:          [_________________]  │
│              [_________________]  │
│              [_________________]  │
│        [Save]                      │
└─────────────────────────────────────┘
```

- Visible only when `hasMinRole(user.role, "speaker")`
- Fetches current bio & designation from `/api/speakers/me`
- Saves via `PATCH /api/speakers/me` (existing endpoint)
- Non-speakers (attendees) don't see this section at all
- Removed `/speakers/update-info/` page entirely
