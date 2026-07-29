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
- Fetches current bio & designation from `GET /api/speakers/me`
- `GET /api/speakers/me` returns `{ speaker_profile_id: null, ... }` when no profile exists
- Save logic (create-or-update):
  1. Call `GET /api/speakers/me` on mount
  2. If `speaker_profile_id === null`: call `POST /api/speakers/me` with `{ bio, designation }` to create
  3. If profile exists: call `PATCH /api/speakers/me` with `{ bio, designation }` to update
- **New endpoint required**: `POST /api/speakers/me`
  - Gate: `requireRole("speaker")` (speaker+ via hierarchy)
  - Body: `{ bio: string | null, designation: string | null }`
  - Sets `user_id` from authenticated user
  - Returns 409 if profile already exists
- Non-speakers (attendees) don't see this section at all
- Removed `/speakers/update-info/` page entirely
