# SPEC-03: Staff Event Dashboard

## Current state

`/staff/events/[id]/page.tsx` shows event info + action buttons. No sections.

## Target state

A dashboard with role-gated sections rendered as cards/sections on one page.

### Layout

```
┌─────────────────────────────────────────┐
│ StatusBadge  Event Title                │
│ Date · Time · Venue                     │
│ Description                             │
├─────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│ │ Overview │ │  Course  │ │ Speakers │ │
│ │ (all)    │ │(f+ spkr) │ │(admin+)  │ │
│ └──────────┘ └──────────┘ └──────────┘ │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│ │ Support  │ │  Kiosk   │ │ Surveys  │ │
│ │(f+ a+ sa)│ │(f+ a+ sa)│ │(f+ a+ sa)│ │
│ └──────────┘ └──────────┘ └──────────┘ │
└─────────────────────────────────────────┘
```

### Section details

| Section | Role gate | Contents |
|---|---|---|
| **Overview** | all staff (f+) | Event info, attendee count, publish/edit/delete buttons |
| **Course** | speaker+ | View course (f+), build course (speaker) |
| **Speakers** | admin+ | Assign/remove speakers from event |
| **Support** | facilitator+ | Event-specific support chat |
| **Kiosk** | facilitator+ | QR attendance scanner |
| **Surveys** | facilitator+ | Create/manage surveys |

### Access control

`isFacilitator` → renamed to `isStaff` using `hasMinRole(role, "facilitator")`.
Section rendering uses `hasMinRole(role, requiredRole)`.
