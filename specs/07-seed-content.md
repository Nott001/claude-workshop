# 07. Seed — content (course, events, speakers)

## Goal

Add to `supabase/seed.sql` the domain content a local developer needs to see and
click through: a course with modules and lessons, an active (published) event
and a draft one, a speaker profile, facilitator assignment, and community links.

## Run order

After `06` (extends the same `seed.sql`; needs auth users in place).

## Files touched

- `supabase/seed.sql`

## Prerequisites

- Sheet `06` complete; idempotence convention chosen there holds.

## Steps

1. Extend `seed.sql` with a `-- content` section, ordered after `-- auth users`.
2. **Course → modules → lessons.** Create:
   - one `COURSE` (e.g. "Intro to Product")
   - 2 `MODULE` rows, `sequence_order` 1 and 2
   - 2 `LESSON` rows per module (`content_type`, `content_url` matching
     `src/shared/types.ts`)
     Capture returned IDs with `RETURNING` or fixed IDs; be internally consistent.
3. **Events.** Create:
   - one `EVENT` with `status = 'active'` for today-ish dates and a non-zero
     `price`, `currency`
   - one `EVENT` with `status = 'draft'`
     Match column constraints from `supabase/migrations/00001_initial_schema.sql`
     (`chk_event_time`, `chk_event_price_nonneg`).
4. **Assignments.** Link the active event to:
   - a facilitator via `EVENT_FACILITATOR` (use the seeded facilitator `USER`)
   - a speaker via `EVENT_SPEAKER` → `SPEAKER_PROFILE` (use the seeded speaker)
5. **Community links.** Add 1–2 to the active event referencing the
   `COMMUNITY_LINK` columns (`platform`, `label`, `url`, `sequence_order`).
6. Keep every insert idempotent per the sheet-06 convention. Do not assume
   sequences; use explicit, fixed numeric IDs where the application reads back
   rows, and note anything that must be unique (`EVENT.title`).

## Verification

- `pnpm db:reset` succeeds end-to-end (auth + content seed).
- `SELECT * FROM "EVENT";` shows two rows (one `active`, one `draft`).
- The active event joins to a course, a session room lesson set, a facilitator,
  a speaker profile, and ≥1 community link:
  `EVENT → COURSE`, `EVENT_FACILITATOR(event_id)`, `EVENT_SPEAKER → SPEAKER_PROFILE`,
  `COMMUNITY_LINK.event_id`.
- Re-running `pnpm db:reset` does not error on the seeded content (idempotence
  holds).

## Risks / notes

- Column `EVENT.title` has no unique constraint today; if you choose fixed IDs
  you still must not duplicate `SPEAKER_PROFILE.user_id` (it is UNIQUE).
- Keep content finite (1 course, 2 events, 4–6 lessons) so the dev DB stays
  readable.
