# Spec 004 — Current-topic card (courses domain)

## Goal

Add a prominent card that tells every attendee which lesson the speaker is
pointing at. It is driven by the shared, staff-controlled highlight. When no
highlight is set it falls back to the first lesson of the module that is live
right now; when there is neither, it shows an empty state.

The fallback rule lives in a pure, testable helper; the card is presentational.

## Scope

- New pure helper `resolveCurrentTopic` + tests.
- New `CurrentTopicCard` component.
- No schema change (lessons only carry `description`, `content_type`,
  `content_url` — the card surfaces the description).

## Implementation

### 1. New file: `src/modules/courses/lib/current-topic.ts`

```ts
export interface CurrentTopic {
  lesson: Lesson;
  moduleName: string;
  startTime: string | null;
  endTime: string | null;
  speakerName: string | null;
}

export function resolveCurrentTopic(
  modules: ModuleWithLessons[],
  highlightedLessonId: number | null,
  now: Date,
): CurrentTopic | null;
```

Behavior:

1. If `highlightedLessonId` is set, find that lesson across all modules and
   return it with its parent module. Prefer the explicit highlight.
2. Else find the live module via `findLiveModule(modules, eventDate, now)` —
   **requires `eventDate`**, so the signature needs it:

   ```ts
   export function resolveCurrentTopic(
     modules: ModuleWithLessons[],
     eventDate: string,
     highlightedLessonId: number | null,
     now: Date,
   ): CurrentTopic | null;
   ```

   Return the live module's first lesson (lowest `sequence_order`), never a
   lesson from a `module_type === "qa"` module.

3. Else return `null`.

`speakerName` follows the room's existing rule: the module's
`SPEAKER_PROFILE?.USER?.full_name` (the page decides whether to show it based on
`assignedSpeakerCount`). Use `findLiveModule` from `@/shared/lib/live-module`.

### 2. New file: `src/modules/courses/components/current-topic-card.tsx`

Export `CurrentTopicCard`. Props:

```ts
interface CurrentTopicCardProps {
  topic: CurrentTopic | null;
  speakerName: string | null; // already nulled by the room when count <= 1
  isStaff: boolean;
  settingHighlight: boolean;
  onClearHighlight: () => void;
}
```

Render:

- Container: `rounded-xl border-2 border-brand/30 bg-brand/5 p-6 sm:p-7`
  (echoes the mock's emphasized "Current topic" panel; token-based).
- Eyebrow: `Current topic` with a broadcast icon (material symbol `sensors` or
  `podcasts` — confirm the glyph renders; fall back to `radio_button_checked`).
- With a topic:
  - Lesson `description` as the title (`text-lg font-bold text-fg`).
  - Meta line: `ModuleScheduleBadge` (`startTime`/`endTime`) + `speakerName`
    when present.
  - When `isStaff`: a `Clear highlight` ghost button
    (`border border-border px-2 py-0.5 text-[10px] font-semibold`), calling
    `onClearHighlight`, `disabled` while `settingHighlight`.
- Empty state:
  - `No lesson is being highlighted right now.` for everyone.
  - Staff hint: `Pick a lesson below to point everyone to it.`

Use `ModuleScheduleBadge` from `@/modules/courses/components/module-schedule-badge`.

## Tests

Add `test/current-topic.test.ts` (pure helper only):

- Explicit highlight wins even when another module is live.
- No highlight + live module → returns that module's first lesson by
  `sequence_order`.
- No highlight + no live module → `null`.
- Never returns a lesson from a `module_type === "qa"` module.
- Call the real `resolveCurrentTopic` with hand-built `ModuleWithLessons`
  fixtures; assert on returned `lesson.description` / `moduleName`, not on type
  shapes.

## Definition of done

- `resolveCurrentTopic` covered by tests.
- `CurrentTopicCard` exported, type-checks, lint-clean, uses only defined tokens.
- `pnpm lint`, `pnpm typecheck`, `pnpm format` clean; `pnpm test` green.
- Coverage thresholds not lowered.

## Out of scope

Wiring into the room page (Spec 005), the hero (Spec 002), lesson rows (Spec 003).
