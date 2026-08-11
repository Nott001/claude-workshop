# Spec 002 — Session hero card (events domain)

## Goal

Add a prominent hero card at the top of the course room showing the live-session
facts at a glance: live/ended status, session title, speaker and time range, and
a horizontal progress bar. This mirrors the "Live session header" section of
`do-no-commit/session.html`, using the app's design tokens instead of the mock's
slate palette.

Depends on Spec 001 (`eventProgress`).

## Scope

- New presentational component in `src/modules/events/components/`.
- Rendered by the room page in Spec 005. Not rendered here.
- No data fetching, no routing, no state beyond what is passed in.

## Implementation

### New file: `src/modules/events/components/session-hero.tsx`

Export `SessionHero`. Presentational — compute nothing about time inside; the
caller passes `progress` and the status booleans.

Props:

```ts
interface SessionHeroProps {
  title: string;
  startTime: string | null;
  endTime: string | null;
  speakerName?: string | null; // already nulled by the room when count <= 1
  isLive: boolean; // eventStarted && !eventEnded
  hasEnded: boolean;
  progress: number; // 0–1, from eventProgress
}
```

Render:

- Container: `rounded-xl bg-fg p-6 text-bg` — token inversion gives the mock's
  dark card in light mode and a light card in dark mode. No fixed palette.
- Status row (top, flex justify-between):
  - Badge: `Live now` with a pulsing dot (reuse the pattern from
    `LiveNowTag` but inverted: `bg-red-500/15 text-red-300` is mock-only — use
    token-friendly styling, e.g. `bg-bg/15 text-bg` with an
    `animate-pulse` dot) when `isLive`; `Ended` when `hasEnded`; `Not started`
    otherwise.
  - Right side: current clock time via `new Date().toLocaleTimeString(...)`
    (2-digit hour/minute), ticked every 30s with `useEffect`.
- Title: `<h2>` with the session `title` (truncate).
- Meta line: `chalkboard`-style icon (material symbol `record_voice_over` or
  `school`) + `speakerName` when present + `·` + `formatTime(startTime) – formatTime(endTime)`.
- Progress: track `h-2 w-full rounded-full bg-bg/20` with a fill
  `bg-brand rounded-full transition-[width] duration-500`, width
  `${Math.round(clamped * 100)}%`. Percent label (`n%`) beside it.
  - When `hasEnded` the caller passes `progress = 1`.
  - Clamp `progress` to [0, 1].

Use `formatTime` from `@/shared/lib/date-utils`. Use `material-symbols-rounded`
for icons. Use `@/shared/lib/utils` `cn` if conditional classes are needed.

## Notes

- Do not add a `use client`-style data layer; the room page owns the hooks.
- The hero lives inside the room's `max-w-[896px]` content column (Spec 005).

## Tests

The component is presentational; assert on its pure inputs rather than DOM. Add
no component test for now — the behavior worth pinning (progress math) is
already covered in `test/event-progress.test.ts` (Spec 001). If you add tests,
keep them behavioral (call real helpers), never shape-only.

## Definition of done

- `SessionHero` exported, type-checked, lint-clean.
- No undefined CSS tokens introduced (use `bg`, `fg`, `text-bg`, `brand`,
  `muted-fg`, `border` — not `text-muted-foreground`).
- `pnpm lint`, `pnpm typecheck`, `pnpm format` clean; `pnpm test` green.
- The room page does not yet use it (Spec 005 wires it in).

## Out of scope

Current-topic card (Spec 004), roadmap restyle, personal notes, usher button.
