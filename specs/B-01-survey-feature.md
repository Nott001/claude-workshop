# B-01 Event survey feature

Send a one-time post-event survey to every registered user of an event after it
has ended. The email links to a page where they rate the event out of 5 stars
and can leave a comment; results are shown to staff on the event overview page.

## Trigger and send

- No scheduler. The survey is generated and emailed when staff **send it
  manually** from the event's Surveys section, at their own discretion.
- Sending is only allowed after the event's end time has passed, reusing
  `isEventFinished` (event_date + end_time in local time) — the same rule that
  already marks a past event "complete" on read.
- Only admins and assigned facilitators may send (the same capability that
  flips the toggle), enforced server-side via the event `edit` check.
- The bulk send happens **once per event**; `SURVEY.sent_at` records when.

## Opt-in per event

- Surveys are **not** automatic for every event. Repurpose the existing, unused
  `EVENT.facilitator_surveys_enabled` column as the opt-in flag, renamed to
  `EVENT.survey_enabled` in the migration: only events with it enabled get a
  survey.
- Facilitators and up can flip the toggle in the Surveys section of the staff
  event page (matching the section's existing floor and "admins/assigned
  facilitators").
- The flag must be added to the event create/update zod schemas so the toggle
  persists.

## Registration guard

- Registration must be impossible once an event has ended. Add a guard to
  `POST /api/events/[id]/register` (and the registration state read) rejecting
  when `isEventFinished(event_date, end_time)` is true. This is what makes "no
  late registration" true today, since nothing currently blocks it.

## Recipients

- Every user with a non-cancelled ticket at first send (the same definition the
  staff page uses for the attendee count).
- The send is a snapshot; the ticket-holder set is frozen by the registration
  guard above.
- An event with zero eligible recipients is skipped (no survey created).

## Survey email and link

- New email template plus a new `EMAIL_LOG` `email_type` value: `event_survey`.
  Sends are logged in the existing EMAIL_LOG and appear on the staff Emails
  page.
- Each recipient gets a unique URL: `/surveys/[token]`, with a per-user token
  stored on their `SURVEY_RESPONSE` row.
- **Expiry**: the link dies the earlier of submission or 14 days after
  `SURVEY.sent_at` (the send ran once, so that timestamp is the first send
  attempt for every recipient).
- Failed individual sends can be re-attempted by staff with another click on
  "Send survey", which retries only the responses never delivered, until
  `SURVEY.sent_at` is more than 14 days ago; then they are left failed.
- Responses are **attributed to the attendee** through the token; there is no
  optional email field (we already know it).

## Survey form

- Rating 1-5 stars: **required**.
- Optional free-text comment.
- The survey page is reachable by token URL for attendees, plus a staff preview
  of the form from the event page.
- Submitted or expired tokens show an already-submitted/expired state, never
  the form.

## Database schema

Repurpose the existing, unused generic survey tables via a **new** migration
(`00019`), never by editing an existing one, and clean them up in the process:

- `SURVEY` — gutted to one row per surveyed event. Keep `id` and `event_id`
  (now `NOT NULL UNIQUE`, `ON DELETE CASCADE`); drop `course_id`, `created_by`,
  `title`, `description`, `is_active`; add `sent_at TIMESTAMPTZ` (when the bulk
  send ran — the 14-day expiry/retry anchor).
- `SURVEY_QUESTION` and `SURVEY_ANSWER` — dropped. The survey is a fixed
  rating + comment form, so each answer lives directly on the response row.
- `SURVEY_RESPONSE` — one row per recipient. Add `token VARCHAR UNIQUE NOT NULL`
  (the per-attendee URL), `sent_at TIMESTAMPTZ` (successful delivery; drives
  retries), `rating INT CHECK (rating BETWEEN 1 AND 5)` and `comment TEXT`,
  both nullable until submitted. `submitted_at` already exists but is made
  nullable — `NOT NULL DEFAULT now()` would make every unsubmitted row look
  submitted.
- `survey_question_type` — dropped; `SURVEY_QUESTION` was its only user.
- `EMAIL_LOG` — extend the `email_type` enum with `event_survey`.
- `EVENT.survey_enabled` — renamed from the unused `facilitator_surveys_enabled`
  (same `BOOLEAN NOT NULL DEFAULT false`).
- No new anon/authenticated grants: every access goes through the service
  client. The tables keep RLS enabled with no policies (deny-by-default).

## API

- `POST /api/events/[id]/register` — reject once the event has ended (new
  guard).
- `PATCH /api/events/[id]` — accept and persist `survey_enabled`.
- `POST /api/events/[id]/survey/send` — staff with the `edit` capability only;
  rejects when the event is not finished or the survey is not enabled, then
  creates the survey + response rows and sends the emails. Re-running it after
  a partial failure retries only the undelivered responses within the 14-day
  window; events with zero eligible recipients get no survey created.
- `GET /api/surveys/[token]` — public; returns the event title and the response
  row's submitted state if the token is valid, unsubmitted, and within its
  window. The form itself is fixed (rating + comment), so no questions are
  returned.
- `POST /api/surveys/[token]/submit` — public; validates the token and writes the
  rating and optional comment, then marks the link used.
- `GET /api/events/[id]/survey` — staff (facilitator and up); returns the
  results: average rating, per-star counts (1 through 5), and the comments with
  their rating and the attendee's name.

## Staff results display

- The Surveys section on the staff event page (facilitator floor, currently a
  "Coming soon" placeholder) becomes:
  - The opt-in toggle for surveys.
  - A "Send survey" button (admins/assigned facilitators, shown once the event
    has ended and no survey exists yet) plus the send result: recipients,
    delivered, failed, and which responses were retried.
  - Send status: whether the survey was sent, when, and how many responded.
  - Results, Apple-App-Store style: average rating, a bar per star count
    (1-5), and the list of comments with their rating and the attendee name.
  - A link to preview the survey form.

## Not in scope

- "Join the StartupLab community" call-to-action after submission (a separate
  task).
- Editable survey questions (the form is fixed rating + comment).
- Per-event custom send times; other question types; image/rating scales beyond
  1-5.
- Automated or scheduled sending — the survey goes out when staff send it.
