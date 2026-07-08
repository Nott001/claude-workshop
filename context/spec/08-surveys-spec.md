# Build Phase 8 — Surveys

## Context

After an event, facilitators need to collect structured feedback from attendees via surveys. Facilitators build surveys with text, multiple-choice, and rating questions. Attendees submit one response per survey. This phase depends on Phase 3 (event context exists for survey targeting).

## Objective

Build the survey subsystem: migrations for SURVEYS, SURVEY_QUESTIONS, SURVEY_RESPONSES, SURVEY_ANSWERS; facilitator survey builder; attendee survey submission; facilitator response browsing.

## Scope

- Database migrations: SURVEYS, SURVEY_QUESTIONS, SURVEY_RESPONSES, SURVEY_ANSWERS (all fields, FKs, unique constraints per data-model.md)
- API routes:
  - `GET /api/events/[eventId]/surveys` — list surveys for event (facilitator: all; attendee: available)
  - `POST /api/events/[eventId]/surveys` — create survey (facilitator)
  - `GET /api/surveys/[id]` — get survey with questions
  - `PATCH /api/surveys/[id]` — update survey title (facilitator)
  - `DELETE /api/surveys/[id]` — delete survey (facilitator); cascades to questions, responses, answers
  - `POST /api/surveys/[id]/questions` — add question (facilitator)
  - `PATCH /api/surveys/[id]/questions/[questionId]` — update question (facilitator)
  - `DELETE /api/surveys/[id]/questions/[questionId]` — remove question (facilitator)
  - `POST /api/surveys/[id]/responses` — submit response (attendee); validates one per user
  - `GET /api/surveys/[id]/responses` — list responses (facilitator only)
  - `GET /api/surveys/[id]/responses/[responseId]` — get response with answers (facilitator only)
- Screens:
  - `/events/[id]/surveys` — survey list (facilitator: manage; attendee: available surveys)
  - `/events/[id]/surveys/new` — survey builder (facilitator): add title, add/edit/reorder questions
  - `/events/[id]/surveys/[surveyId]/edit` — edit survey (facilitator)
  - `/events/[id]/surveys/[surveyId]` — survey form (attendee): renders all question types
  - `/events/[id]/surveys/[surveyId]/confirmed` — post-submit confirmation (attendee)
  - `/events/[id]/surveys/[surveyId]/responses` — response browser (facilitator)
- `modules/surveys/` domain logic:
  - Rating questions: `answer_value` must be integer 1–5
  - Text questions: use `answer_text` only
  - Multiple-choice: use `answer_text` for selected option
  - One response per `(survey_id, user_id)` enforced by DB unique constraint
  - Question ordering via `sequence_order`
  - Survey response validation: exactly one answer per question in the survey

## Constraints

- Attendee may submit only one response per survey (enforced at DB and API levels)
- Facilitator cannot submit survey responses
- Survey questions cannot be reordered after creation in MVP (order set on creation)
- Deleting a survey cascades to all questions, responses, and answers

## Deliverable

- Facilitator builds a survey with mixed question types; it appears in the event survey list
- Attendee opens the survey, answers all questions, submits; sees confirmation
- Revisiting the survey shows "Already submitted" instead of the form
- Facilitator can browse all responses per survey

## Acceptance Criteria

- [ ] Facilitator creates a survey with 2+ questions of different types; they render correctly in the form
- [ ] Attendee submits a survey; the confirmation page displays
- [ ] Attendee navigates back to the same survey URL; sees "You have already submitted"
- [ ] Attempting to submit a second response via API returns 409 Conflict
- [ ] Facilitator can view the survey response list and expand individual responses
- [ ] Rating answers are stored as 1–5 integers and displayed correctly
