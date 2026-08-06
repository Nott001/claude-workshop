# SPEC-01 — Module schedule validation

## Scope

Extend `moduleSchema` so the module endpoints can accept and validate schedule
fields: times are well-formed `HH:mm`, paired, and ordered; `speaker_profile_id`
is a positive int or `null`. Validation only — the route still decides who may
write (SPEC-05).

## Background

`moduleSchema` guards both `POST /api/courses/[id]/modules` and
`PATCH /api/modules/[id]`. Schedule edits arrive as PATCHes, so the schema must
accept them without disturbing the create flow, which never sends them.

## Changes

`src/modules/courses/lib/schemas.ts`:

- `start_time` / `end_time`: `z.union([z.null(), z.string().regex(HH:mm)])`,
  optional. `null` is the "clear" value.
- `speaker_profile_id`: `z.union([z.null(), z.coerce.number().int().positive()])`,
  optional. Coercion applies only to real numbers; `null` short-circuits before
  it.
- `superRefine`: either both times are present or both are absent; when present,
  `end_time > start_time`. Zero-padded `HH:mm` compares lexicographically, so no
  arithmetic is needed.

## Non-goals

- No knowledge of which speakers are assigned to the event — that is the
  route's job (SPEC-05).
- No changes to `qaModuleSchema` or `lessonSchema`.

## Files touched

- `src/modules/courses/lib/schemas.ts`

## Verification

- Schedule suite cases: a partial pair is rejected, an inverted order is
  rejected, a malformed format is rejected, `null` clears are accepted, and a
  plain rename without schedule keys still parses.
