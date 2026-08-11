# Spec 003 — Openable lesson rows (courses domain)

## Goal

Turn the room's plain-text lesson rows into openable rows: a file-type icon per
`content_type`, a click that opens `content_url` in a new tab, a visible
"Current" affordance for the speaker-highlighted lesson, and the existing
staff-only highlight toggle preserved. Also delete the unused `LessonViewer`
component.

## Scope

- New pure helper `contentTypeMeta` + tests.
- New `RoomLessonRow` component (named to avoid clashing with the course
  builder's existing `lesson-row.tsx`).
- Delete `src/modules/courses/components/lesson-viewer.tsx` (confirmed unused —
  only a self-reference exists).
- The room page switches to `RoomLessonRow` in Spec 005.

## Implementation

### 1. New file: `src/modules/courses/lib/content-type-meta.ts`

```ts
export function contentTypeMeta(type: ContentType): { icon: string; label: string };
```

Mapping (material-symbols-rounded names):

- `pdf` → `picture_as_pdf` / "PDF"
- `video` → `play_circle` / "Video"
- `image` → `image` / "Image"
- `link` → `link` / "Link"

`ContentType` is `"pdf" | "video" | "image" | "link"` from `@/shared/types`.

### 2. New file: `src/modules/courses/components/room-lesson-row.tsx`

Props:

```ts
interface RoomLessonRowProps {
  lesson: Lesson;
  isHighlighted: boolean;
  isStaff: boolean;
  settingHighlight: boolean;
  onToggleHighlight: () => void;
}
```

Render:

- Container row: `flex items-center justify-between gap-2`.
- Content side (opens the lesson):
  - When `lesson.content_url` exists: an `<a href={content_url} target="_blank"
rel="noopener noreferrer">` containing the type icon + description
    (truncated). Openable affordance visible via `hover:text-brand`.
  - When `content_url` is null: a non-anchor span, dimmed
    (`text-muted-fg/60`), same layout. No dead link.
  - Icon: `<span className="material-symbols-rounded text-[14px]">{icon}</span>`
    from `contentTypeMeta`.
- Highlighted state (visible to all — this is the "guide"):
  - `isHighlighted` → brand ring on the row (`border-brand ring-1 ring-brand`
    on a `rounded-lg border` wrapper) plus a small `Current` badge
    (`text-[10px] font-bold uppercase text-brand`).
- Staff controls (unchanged behavior, reuse the existing handler props):
  - `isStaff` → the current `Highlight / Highlighted` toggle button, copied
    verbatim from `src/app/courses/[courseId]/room/page.tsx:209-225`,
    `disabled` while `settingHighlight`.

Keep the row height/typography consistent with today's lesson list
(`text-xs text-muted-fg`).

### 3. Delete `src/modules/courses/components/lesson-viewer.tsx`

It is dead code (no imports anywhere). Removing it is the "remove the unused
resource viewer modal" cleanup. Check `grep -r "LessonViewer\|lesson-viewer"
src test` returns nothing before deleting.

## Tests

Add `test/content-type-meta.test.ts`:

- Each of the four content types maps to its expected icon + label.
- Call the real `contentTypeMeta` — assert on the return values.

Existing `test/lesson-utils.test.ts` and `test/qa-panel.test.ts` must keep
passing.

## Definition of done

- `contentTypeMeta` covered by tests.
- `RoomLessonRow` exported; renders an anchor for lessons with `content_url` and
  an inert row otherwise.
- `lesson-viewer.tsx` deleted; no dangling imports.
- `pnpm lint`, `pnpm typecheck`, `pnpm format` clean; `pnpm test` green.
- Coverage thresholds not lowered.

## Out of scope

Wiring into the room page (Spec 005), the current-topic card (Spec 004), the
hero (Spec 002), and the builder's `lesson-row.tsx`.
