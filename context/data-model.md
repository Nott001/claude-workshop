# Phase 3 — Data Model Planning

## Entity / Field Finalization

### USERS

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| user_id | int PK | NOT | auto | |
| full_name | varchar | NOT | — | |
| email | varchar UK | NOT | — | |
| clerk_id | varchar UK | NOT | — | Auth source of truth |
| role | enum(attendee,speaker,facilitator) | NOT | 'attendee' | |
| created_at | timestamptz | NOT | now() | Existing |
| updated_at | timestamptz | NOT | now() | **Added** — track role changes |

### COURSE

| Field | Type | Nullable | Default |
|---|---|---|---|
| course_id | int PK | NOT | auto |
| course_name | varchar | NOT | — |
| course_description | text | YES | NULL |
| created_at | timestamptz | NOT | now() | **Added** |
| updated_at | timestamptz | NOT | now() | **Added** |

### MODULES

| Field | Type | Nullable | Default |
|---|---|---|---|
| module_id | int PK | NOT | auto |
| course_id | int FK | NOT | — |
| module_name | varchar | NOT | — |
| sequence_order | int | NOT | — |
| created_at | timestamptz | NOT | now() | **Added** |
| updated_at | timestamptz | NOT | now() | **Added** |

### LESSONS

| Field | Type | Nullable | Default |
|---|---|---|---|
| lesson_id | int PK | NOT | auto |
| module_id | int FK | NOT | — |
| description | varchar | NOT | — |
| content_type | enum(pdf,video,image,link) | NOT | — |
| content_url | varchar | NOT | — |
| total_units | int | NOT | 1 |
| sequence_order | int | NOT | — |
| created_at | timestamptz | NOT | now() | **Added** |
| updated_at | timestamptz | NOT | now() | **Added** |

### EVENTS

| Field | Type | Nullable | Default |
|---|---|---|---|
| event_id | int PK | NOT | auto |
| course_id | int FK/UK | YES | NULL | 0–1 relationship with COURSE |
| title | varchar | NOT | — |
| event_date | date | NOT | — |
| start_time | time | NOT | — |
| end_time | time | NOT | — |
| venue_address | text | YES | NULL |
| venue_name | varchar | NOT | — |
| lat | numeric(10,7) | YES | NULL |
| lng | numeric(10,7) | YES | NULL |
| price | numeric(10,2) | NOT | 0 | **Added** — ticket price; non-negative |
| currency | char(3) | NOT | 'PHP' | **Added** — ISO 4217 currency code |
| created_at | timestamptz | NOT | now() | **Added** |
| updated_at | timestamptz | NOT | now() | **Added** |

### LIVE_SESSION_STATE

| Field | Type | Nullable | Default |
|---|---|---|---|
| event_id | int PK/FK | NOT | — |
| current_lesson_id | int FK | YES | NULL | No lesson selected initially |
| updated_by | int FK | NOT | — |
| updated_at | timestamptz | NOT | now() |

No changes.

### LESSON_PROGRESS

| Field | Type | Nullable | Default |
|---|---|---|---|
| lesson_id | int PK/FK | NOT | — |
| user_id | int PK/FK | NOT | — |
| units_completed | int | NOT | 0 |
| is_completed | bool | NOT | false |
| updated_at | timestamptz | NOT | now() | **Added** |

No `created_at` — composite PK implies first insert.

### CHAT_MESSAGES

| Field | Type | Nullable | Default |
|---|---|---|---|
| message_id | int PK | NOT | auto |
| event_id | int FK | NOT | — |
| channel | enum(support,live_qa) | NOT | — |
| user_id | int FK | NOT | — |
| message | text | NOT | — |
| sent_at | timestamptz | NOT | now() |
| read_by | int FK | YES | NULL | Coarse last-read pointer (see gap resolution) |
| updated_at | timestamptz | YES | NULL | **Added** — for moderation edits |

### PAYMENTS

| Field | Type | Nullable | Default |
|---|---|---|---|
| payment_id | int PK | NOT | auto |
| user_id | int FK | NOT | — |
| event_id | int FK | NOT | — |
| hitpay_reference_id | varchar UK | YES | NULL | Set after HitPay response |
| status | enum(pending,paid,failed,refunded) | NOT | 'pending' |
| paid_at | timestamptz | YES | NULL |
| amount | numeric(10,2) | NOT | 0 | **Added** — amount charged (snapshotted from event price at payment time); non-negative |
| currency | char(3) | NOT | 'PHP' | **Added** — ISO 4217 currency code (snapshotted from event) |
| created_at | timestamptz | NOT | now() | **Added** |
| updated_at | timestamptz | NOT | now() | **Added** |

### TICKETS

| Field | Type | Nullable | Default |
|---|---|---|---|
| payment_id | int PK/FK | NOT | — | 1:1 with PAYMENTS |
| user_id | int FK | NOT | — |
| event_id | int FK | NOT | — |
| qr_token | varchar UK | NOT | — |
| status | enum(issued,checked_in,cancelled) | NOT | 'issued' |
| issued_at | timestamptz | NOT | now() |
| checked_in_by | int FK | YES | NULL |
| updated_at | timestamptz | NOT | now() | **Added** — track status transitions |

### SPEAKER_PROFILES

| Field | Type | Nullable | Default |
|---|---|---|---|
| speaker_profile_id | int PK | NOT | auto |
| user_id | int FK/UK | NOT | — |
| bio | text | YES | NULL |
| photo_url | varchar | YES | NULL |
| designation | varchar | YES | NULL |
| created_at | timestamptz | NOT | now() | **Added** |
| updated_at | timestamptz | NOT | now() | **Added** |

`designation` left as varchar rather than enum to allow free-form titles (e.g., "Senior Engineer", "Guest Lecturer").

### EVENT_SPEAKERS

| Field | Type | Nullable | Default |
|---|---|---|---|
| event_id | int PK/FK | NOT | — |
| speaker_profile_id | int PK/FK | NOT | — |
| created_at | timestamptz | NOT | now() | **Added** — track assignment time |

No additional fields — speaking order, session time deferred.

### SURVEYS

| Field | Type | Nullable | Default |
|---|---|---|---|
| survey_id | int PK | NOT | auto |
| event_id | int FK | NOT | — |
| title | varchar | NOT | — |
| created_at | timestamptz | NOT | now() |
| updated_at | timestamptz | NOT | now() | **Added** |

### SURVEY_QUESTIONS

| Field | Type | Nullable | Default |
|---|---|---|---|
| question_id | int PK | NOT | auto |
| survey_id | int FK | NOT | — |
| question_text | text | NOT | — |
| submitted_type | enum(text,multiple_choice,rating) | NOT | — |
| sequence_order | int | NOT | — |
| created_at | timestamptz | NOT | now() | **Added** |
| updated_at | timestamptz | NOT | now() | **Added** |

### SURVEY_RESPONSES

| Field | Type | Nullable | Default |
|---|---|---|---|
| response_id | int PK | NOT | auto |
| survey_id | int FK | NOT | — |
| user_id | int FK | NOT | — |
| created_at | timestamptz | NOT | now() |

UK(survey_id, user_id) — one response per user per survey.

### SURVEY_ANSWERS

| Field | Type | Nullable | Default |
|---|---|---|---|
| answer_id | int PK | NOT | auto |
| response_id | int FK | NOT | — |
| question_id | int FK | NOT | — |
| answer_text | text | YES | NULL |
| answer_value | int | YES | NULL |
| created_at | timestamptz | NOT | now() | **Added** |

### EMAIL_LOGS

| Field | Type | Nullable | Default |
|---|---|---|---|
| log_id | int PK | NOT | auto |
| user_id | int FK | NOT | — |
| email_type | enum(registration_confirmation,ticket_issued,check_in_confirmed) | NOT | — |
| status | enum(sent,failed) | NOT | — |
| sent_at | timestamptz | YES | NULL | **Added** — actual send time vs. log creation |
| created_at | timestamptz | NOT | now() | **Added** |
| updated_at | timestamptz | NOT | now() | **Added** |

---

## Validation Logic

| Rule | Enforcement |
|---|---|
| EVENTS.start_time < EVENTS.end_time | CHECK constraint |
| EVENTS.price >= 0 | CHECK constraint |
| EVENTS.currency is ISO 4217 3-letter code | Application-level or CHECK constraint |
| PAYMENTS.amount >= 0 | CHECK constraint |
| PAYMENTS.amount and currency snapshotted from EVENTS at payment creation | Application-level: copy from EVENTS when inserting PAYMENT |
| TICKETS.qr_token generated only after PAYMENTS.status = paid | Application-level: insert TICKET only in HitPay webhook handler |
| LESSON_PROGRESS.units_completed ≤ LESSONS.total_units | CHECK constraint or app-level guard |
| LESSON_PROGRESS.is_completed = TRUE iff units_completed = total_units | Trigger or app-level on write |
| SURVEY_ANSWERS: exactly one of (answer_text, answer_value) populated per submitted_type | Application-level (CHECK impractical due to conditional logic) |
| PAYMENTS.status transitions: pending→paid\|failed, paid→refunded only | Application-level guard |
| TICKETS.status transitions: issued→checked_in\|cancelled | Application-level guard |
| LIVE_SESSION_STATE.current_lesson_id must belong to course linked to event | Application-level JOIN before allowing update |
| qr_token single-use: reject if TICKETS.status = checked_in already | Application-level check before update |
| SURVEY_RESPONSES UK(survey_id, user_id) prevents duplicate submission | DB unique constraint |

---

## Schema Gap Resolutions

**CHAT_MESSAGES.read_by — keep single FK as coarse "last-read pointer"**

Per-user read receipts would need a `MESSAGE_READS(message_id, user_id, read_at)` join table with higher write volume. For MVP, a single FK is sufficient for the facilitator to see who last viewed the channel. True per-user read-state is deferred (as flagged in OVERVIEW.md).

**EVENT_SPEAKERS — no extra fields needed for MVP**

The join table's FK pair satisfies Phase 1's "assign speakers to an event" story. Speaking order, session time, and per-speaker lesson assignments are deferred.

**EMAIL_LOGS — enum values defined**

`email_type`: `registration_confirmation`, `ticket_issued`, `check_in_confirmed`. `status`: `sent`, `failed`. `sent_at` added to distinguish record creation from actual send time.

---

## Index Recommendations

| Type | Table | Columns | Rationale |
|---|---|---|---|
| UNIQUE | USERS | clerk_id | Auth lookup |
| UNIQUE | USERS | email | Duplicate prevention |
| INDEX | USERS | role | Filter users by role |
| INDEX | MODULES | (course_id, sequence_order) | Order modules within a course |
| INDEX | LESSONS | (module_id, sequence_order) | Order lessons within a module |
| UNIQUE | EVENTS | course_id | 0–1 relationship |
| INDEX | EVENTS | event_date | List upcoming events |
| UNIQUE | TICKETS | qr_token | Fast QR scan lookup |
| INDEX | TICKETS | (user_id, event_id) | Look up a user's ticket for an event |
| UNIQUE | PAYMENTS | hitpay_reference_id | Prevent duplicate webhooks |
| INDEX | PAYMENTS | (user_id, event_id) | Look up a user's payment for an event |
| INDEX | PAYMENTS | status | Filter pending/paid payments |
| INDEX | CHAT_MESSAGES | (event_id, channel, sent_at) | Paginate messages per channel per event |
| INDEX | CHAT_MESSAGES | user_id | Look up messages by sender |
| UNIQUE | SPEAKER_PROFILES | user_id | One profile per user |
| INDEX | EVENT_SPEAKERS | speaker_profile_id | Reverse lookup: speaker→events |
| UNIQUE | SURVEY_RESPONSES | (survey_id, user_id) | One response per user per survey |
| INDEX | EMAIL_LOGS | (user_id, email_type) | Filter logs by recipient and type |

---

## Acceptance Checklist

- [x] Every business rule from Phase 1 maps to a validation constraint or trigger.
- [x] Every table has explicit nullability and default values.
- [x] Schema gap decisions (read receipts, EVENT_SPEAKERS) recorded with one-line rationale.
- [x] EMAIL_LOGS given explicit enums plus `sent_at` field (beyond OVERVIEW.md baseline).
