# 09. Seed — survey, settings, audit log, storage buckets

## Goal

Finish `supabase/seed.sql` with the remaining app surface a local developer
touches: an active survey with questions on the active event, a couple of system
settings, a sample audit log row, and the four storage buckets the app uploads
to.

This sheet completes the seed; sheet `10` verifies it as a whole.

## Run order

After `08`.

## Files touched

- `supabase/seed.sql`

## Prerequisites

- Sheets `06`–`08` complete; fixed IDs for the active `EVENT` available.

## Steps

1. **Survey.** Insert an active `SURVEY` (event → active event, `is_active =
true`) with 2–3 `SURVEY_QUESTION`s of distinct `question_type`s
   (`text`, `multiple_choice`, `rating`), each `sequence_order` set.
   - Do not seed responses/answers — keep the survey unresponded so the app's
     "send survey" flow has living rows to mail.
2. **System settings.** Insert 1–2 `SYSTEM_SETTING` rows (`setting_key`,
   `setting_value` as JSONB) that the app actually reads (search `SYSTEM_SETTING`
   usage in `src/` before choosing keys). If nothing is read at runtime, omit
   this section rather than invent unused keys.
3. **Audit log.** Insert one `AUDIT_LOG` row (`actor_id` → a seeded user,
   `action` from the enum in `00001`, e.g. `checkin.performed`) so the staff
   audit-log page has a sample row.
4. **Storage buckets.** Insert the four buckets the app references in
   `src/shared/integrations/storage/policy.ts` into the Supabase `storage`
   schema's `buckets` table:

   | bucket id        | public | allowed mime types (from `policy.ts`) |
   | ---------------- | ------ | ------------------------------------- |
   | `event_images`   | true   | jpeg, png                             |
   | `profile_images` | true   | jpeg, png                             |
   | `course_assets`  | false  | pdf, office docs, text, zip, images   |
   | `course_videos`  | false  | mp4, webm, mov, avi, mkv              |
   - Match the columns of `storage.buckets` (`id`, `name`, `public`,
     `file_size_limit`, `allowed_mime_types`, `owner`, `created_at`).
   - `file_size_limit = 50MB`, `allowed_mime_types` copied from
     `BUCKET_CONFIG` in `policy.ts`. Keep them consistent with that file — this
     is a single source of truth that must not drift.

5. Keep idempotence: `ON CONFLICT (id) DO NOTHING` for buckets (their `id` is
   the natural key).

## Verification

- `pnpm db:reset` succeeds.
- `SELECT count(*) FROM "SURVEY";` + `SURVEY_QUESTION` join shows the seeded
  survey with its questions.
- `SELECT * FROM storage.buckets;` lists exactly the four ids above, `public`
  flags and mime lists matching `policy.ts`.
- Audit log / system rows exist if included in step 2/3.

## Risks / notes

- `storage.buckets.allowed_mime_types` is a `text[]`; the app authorizes uploads
  via `policy.ts`, so keep both in sync or the UI advertises a type the bucket
  rejects.
- If the storage column `owner` is NOT NULL, the owner must be a seeded auth
  user id from sheet `06`.
- Check `storage.buckets` columns on the local stack before writing — the exact
  shape varies by Supabase version.
