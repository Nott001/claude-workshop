# Phase 8 — Deployment & Handover

## Output File
`context/deployment.md`

## Objective
Prepare the application for deployment and operational handover. Write to `context/deployment.md`.

## Required Outputs
- **Deployment checklist**:
  - Environment variables/secrets: Clerk keys, HitPay API keys/webhook secret, real-time provider (Supabase) credentials, DB connection string.
  - Migration run against production DB per finalized Phase 3 schema.
  - Webhook endpoints registered with HitPay (payment status callbacks).
  - Real-time transport provider configured for expected concurrent attendee load (from Phase 2 sizing).
- **Environment setup**: dev/staging/prod separation, seed data for course/module/lesson content, at least one test event with test payment credentials.
- **Admin handover notes**: how to create an event, assign speakers, manage roles, operate the kiosk device, read survey results, resend failed emails (EMAIL_LOGS.status = failed).
- **Post-launch improvement backlog**: pull directly from Phase 0's out-of-scope list — reconfirm none have silently crept into v1.

## Constraints
- No new features introduced at this stage — deployment and documentation only.

## Acceptance Criteria
- Checklist items are each independently verifiable (pass/fail, not descriptive).
- Handover notes require no developer involvement for routine organizer/admin operations.
- Backlog items are explicitly labeled "not yet built" and traced to Phase 0.