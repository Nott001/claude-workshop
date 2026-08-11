# Spec 005 — Wire the room page together

## Goal

Compose the components from Specs 001–004 into
`src/app/courses/[courseId]/room/page.tsx`, run against a live dev server, and
leave the app in a shippable state.

Depends on Specs 001, 002, 003, 004. Run last.

## Changes to `src/app/courses/[courseId]/room/page.tsx`

Only the `allowed` branch (where `course` exists) changes structurally. Access
gates, navbar, Q&A modules, and the right aside stay as-is.

### 1. Session hero

Inside the `max-w-[896px]` container, render above the course card:

```tsx
<SessionHero
  title={eventTitle}
  startTime={startTime}
  endTime={endTime}
  speakerName={assignedSpeakerCount > 1 ? (liveModule?.SPEAKER_PROFILE?.USER?.full_name ?? null) : null}
  isLive={eventStarted && !eventEnded}
  hasEnded={eventEnded}
  progress={eventProgress(eventDate, startTime, endTime, new Date())}
/>
```

Compute `progress` once (not per render tick) — pass `new Date()` at render; the
hero and timer handle liveness. `eventProgress` comes from `@/shared/lib/event-progress`.

### 2. Current-topic card

Render below the hero, above the course card:

```tsx
<CurrentTopicCard
  topic={resolveCurrentTopic(course.MODULE, eventDate, highlightedLessonId, new Date())}
  speakerName={assignedSpeakerCount > 1 ? (liveModule?.SPEAKER_PROFILE?.USER?.full_name ?? null) : null}
  isStaff={isStaff}
  settingHighlight={settingHighlight}
  onClearHighlight={handleClearHighlight}
/>
```

### 3. Lesson rows

In the `mod.LESSONS.map` block, replace the current text-row markup with
`RoomLessonRow`:

```tsx
<RoomLessonRow
  key={lesson.id}
  lesson={lesson}
  isHighlighted={highlightedLessonId === lesson.id}
  isStaff={isStaff}
  settingHighlight={settingHighlight}
  onToggleHighlight={() => (highlightedLessonId === lesson.id ? handleClearHighlight() : handleSetHighlight(lesson.id))}
/>
```

Attendees get openable rows + the `Current` affordance; staff keep the toggle —
the existing handlers are reused unchanged.

### 4. Token cleanup (drive-by)

While touching this file, migrate the undefined tokens in the access-state
blocks (`text-muted-foreground`, `text-muted-fg` mix at lines 71, 80–81, 91–92,
110, 146–147) to the defined `text-muted-fg` token so the file uses one
consistent set. No layout change.

## Verification

1. `pnpm format && pnpm lint && pnpm typecheck && pnpm test` — all green;
   coverage thresholds not lowered.
2. Start `pnpm dev` and open a course room as each persona:
   - **Attendee**: hero shows live/ended status + progress; current-topic card
     tracks the highlight; lesson rows open `content_url` in a new tab; no
     highlight controls visible.
   - **Speaker/facilitator**: `Highlight` toggles still work per lesson; `Clear
highlight` appears on the card; `settingHighlight` disables both.
   - Empty states: no highlight + no live module → current-topic empty state;
     `no_course` / `not_started` gates unchanged.
3. Confirm the unused `lesson-viewer.tsx` is gone and nothing imports it.

## Definition of done

- Room page composes hero + current-topic + openable lesson rows; Q&A inline and
  timeline aside unchanged.
- All four gates pass; dev server smoke-tested for attendee and staff.
- Meaningful user-facing change → update `CHANGELOG.md` per repo conventions and
  commit as `feat:` on a short-named branch (imperative subject; body explains
  why, not what).

## Out of scope

Anything not already covered by Specs 001–004. No new dependencies, no schema
changes, no migration.
