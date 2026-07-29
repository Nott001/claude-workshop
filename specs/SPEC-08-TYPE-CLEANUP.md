# SPEC-08: Type Cleanup & Technical Debt

## 1. Shared Event Types

Extract duplicated types into `src/modules/events/lib/types.ts`:

```ts
// Shared response shape from GET /api/events/[id] (via eventDao.findByIdWithCourse)
export interface EventSpeakerProfile {
  id: number;
  user_id: number;
  bio: string | null;
  designation: string | null;
  photo_url: string | null;
  USER: { full_name: string; email: string } | null;
}

export interface EventSpeakerEntry {
  SPEAKER_PROFILE: EventSpeakerProfile;
}

export interface EventWithCourse {
  id: number;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  venue_address: string | null;
  course_id: number | null;
  cover_image_url: string | null;
  status: "draft" | "active" | "complete";
  price: number;
  currency: string;
  description: string | null;
  COURSE: { id: number; course_name: string; course_description: string | null } | null;
  EVENT_SPEAKER: EventSpeakerEntry[];
  attendee_count?: number;
  payment_count?: number;
}
```

All consumers (`fetchEventAccess`, `useRoomAccess`, `useEventDetail`) import from this single file.
Remove the locally-defined interfaces from each file.

## 2. `fetch-event-access.ts` Fixes

### Remove `Record<string, unknown>`

Change `event: Record<string, unknown> | null` to `event: EventWithCourse | null`.

### Remove `.speaker_profile_id` fallback (line 25)

`GET /api/speakers/me` returns `{ id: number, ... }` — the column is `.id`, not `.speaker_profile_id`.

Before:
```ts
speakerProfileId = speakerData?.id ?? speakerData?.speaker_profile_id ?? null;
```

After:
```ts
speakerProfileId = speakerData?.id ?? null;
```

### Remove duplicate check (line 30)

The SPEAKER_PROFILES table uses `id` as its PK. Remove the `speaker_profile_id` OR branch.

Before:
```ts
es.SPEAKER_PROFILES.id === speakerProfileId || es.SPEAKER_PROFILES.speaker_profile_id === speakerProfileId
```

After:
```ts
es.SPEAKER_PROFILES.id === speakerProfileId
```

### Properly type the `.some()` callback

Before:
```ts
(es: { SPEAKER_PROFILES: { id?: number; speaker_profile_id?: number } })
```

After:
```ts
(es: EventSpeakerEntry)
```

### Parallelize role-specific fetches

Before (sequential):
```ts
if (role === "speaker") {
  const speakerRes = await fetch("/api/speakers/me");
  ...
} else if (role !== "facilitator") {
  const ticketRes = await fetch("/api/tickets");
  ...
}
```

After (parallel — fire all potentially needed requests at once):
```ts
const [speakerRes, ticketRes] = await Promise.all([
  role === "speaker" ? fetch("/api/speakers/me") : Promise.resolve(null),
  role !== "facilitator" && role !== "speaker" ? fetch("/api/tickets") : Promise.resolve(null),
]);
```

## 3. `useRoomAccess.ts` Fixes

### Remove all `as` casts

Replace:
```ts
setEventTitle((eventData.title as string) || "Event Room");
setEventDate((eventData.event_date as string) ?? "");
setStartTime((eventData.start_time as string) ?? "");
setEndTime((eventData.end_time as string) ?? "");
```

With typed access (eventData is now `EventWithCourse`):
```ts
setEventTitle(eventData.title || "Event Room");
setEventDate(eventData.event_date ?? "");
setStartTime(eventData.start_time ?? "");
setEndTime(eventData.end_time ?? "");
```

### Replace `course_id as number`

Before:
```ts
if (eventData.course_id) {
  await fetchCourse(eventData.course_id as number);
}
```

After:
```ts
if (eventData.course_id) {
  await fetchCourse(eventData.course_id);
}
```

The type is already `number | null`, so the truthy check narrows it — no cast needed.

### Simplify access logic

The nested if-else for each role duplicates the fetchCourse and setAccess calls.
Restructure to compute `access` at a single return point:

```ts
const speakerAssigned = role === "speaker" ? accessData.isSpeakerAssigned : true;
const hasTicketOrBypass = role === "facilitator" || role === "speaker" || accessData.hasTicket;

if (!speakerAssigned) { setAccess("denied"); return; }
if (!hasTicketOrBypass) { setAccess("no_ticket"); return; }

if (eventData.course_id) await fetchCourse(eventData.course_id);
setAccess(eventData.course_id ? "allowed" : "no_course");
```

## 4. `useEventDetail.ts` Fixes

### Align EVENT_SPEAKER naming

The Supabase v2 JS client uses the query alias as the response key.
`findByIdWithCourse` selects `.select("*, COURSE(*), EVENT_SPEAKER(..."))`.
Supabase returns `EVENT_SPEAKER` (singular, matching the table name).

The `EventDetail` and `EventAccessData` types should use `EVENT_SPEAKER` not `EVENT_SPEAKERS`.
Update all references throughout the codebase.

### Update isFacilitator to use hierarchy

Before:
```ts
const isFacilitator = userRole === "facilitator";
```

After (import from SPEC-01 hierarchy utility):
```ts
const isStaff = userRole ? hasMinRole(userRole, "facilitator") : false;
```

### Update attendeesLoading check

Before:
```ts
const attendeesLoading = userRole === "facilitator" ? !attendeesLoaded : false;
```

After:
```ts
const attendeesLoading = userRole && hasMinRole(userRole, "facilitator") ? !attendeesLoaded : false;
```

## 5. Files to modify

| File | Changes |
|---|---|
| `src/modules/events/lib/types.ts` | **New** — shared `EventWithCourse`, `EventSpeakerEntry`, `EventSpeakerProfile` |
| `src/modules/events/lib/fetch-event-access.ts` | Use typed event, remove fallback checks, parallel fetches |
| `src/modules/events/lib/use-room-access.ts` | Remove `as` casts, simplified access logic |
| `src/modules/events/lib/use-event-detail.ts` | Align naming, use `hasMinRole`, remove local types |
| `src/app/speaker/event/[eventId]/page.tsx` | Use shared types instead of local interfaces |
