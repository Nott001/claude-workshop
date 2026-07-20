# CHANGELOG

## [Unreleased]

### feat: replace real-time live sessions with self-serve event resource rooms

- **supabase/migrations/00017_drop_live_session_state.sql** — new migration: drop `LIVE_SESSION_STATE` table and remove from realtime publication
- **app/api/live/** — delete all live session API routes (GET/PATCH session, POST state)
- **modules/live-session/index.ts** — delete `liveSessionUpdateSchema` module
- **lib/realtime/index.ts** — remove `subscribeToLiveSession` and `LiveSessionState` import
- **types/index.ts** — remove `SessionStatus` type and `LiveSessionState` interface
- **test/live-session.test.ts** — delete (154 total tests, 0 in live-session)
- **app/events/[id]/page.tsx** — remove session polling, session state, "Start session" button, and debug bypass; add `isEventStarted` check; add "Enter event room" button for speakers always and for attendees when event has started + has ticket
- **app/events/[id]/live/page.tsx** — rewrite as self-serve resource room: loads linked curriculum, displays lessons as clickable resource cards (grouped by module), opens a modal with `LessonViewer` on card click; access control: speakers/facilitators always allowed, attendees require valid ticket + event started
- **app/api/courses/[id]/route.ts** — remove `requireRole("facilitator")` from GET so event room can fetch course data for all authorized users

### feat: allow courses to be linked to multiple events

- **supabase/migrations/00016_remove_course_id_unique.sql** — new migration: drop UNIQUE constraint on `EVENTS.course_id` so the same course can be linked to many events
- **app/api/events/route.ts** — remove uniqueness check (no longer querying EVENTS for duplicate course_id)
- **app/api/events/[id]/route.ts** — same removal in PATCH handler

### fix: allow relative storage URLs in event and lesson schemas

- **modules/course-content/index.ts** — remove `.url()` validation from `content_url` in lessonSchema (storage returns relative paths via proxy)
- **modules/event-management/index.ts** — remove `.url()` validation from `cover_image_url` in eventBaseSchema and `photo_url` in speakerProfileUpdateSchema
- **test/course-content.test.ts** — update "rejects invalid URL" test to expect relative/invalid URLs to pass
- **test/event-management.test.ts** — same update for cover_image_url test

### fix: show course name in event dropdown instead of raw value

- **app/events/new/page.tsx** — use `SelectValue` render prop to display "No curriculum linked" when value is `__none__` and course name when a course is selected
- **app/events/[id]/edit/page.tsx** — same fix

### fix: show all courses in event form dropdown instead of filtering linked ones

- **app/events/new/page.tsx** — remove `linkedIds` filtering that excluded courses already linked to other events; show all courses and let the backend's UNIQUE constraint enforce exclusivity
- **app/events/[id]/edit/page.tsx** — same fix; also remove the now-unnecessary `/api/events` fetch for course filtering

### fix: show API errors and add create-course link in event course dropdown

- **app/events/new/page.tsx** — surface fetch errors from `/api/courses` to the user instead of silently swallowing them; show "No courses available — create one first" disabled option in dropdown; add "Create a course" link navigating to `/courses/new`
- **app/events/[id]/edit/page.tsx** — same fixes; also show all courses when the events API fails (instead of hiding courses), and preserve the currently linked course in the dropdown

### refactor: remove Quick Create, progress tracking, and add URL normalization

- **app/courses/page.tsx** — remove Quick Create dialog (button, state, handler, Dialog import)
- **app/courses/[id]/page.tsx** — add `normalizeUrl()` to auto-prefix `https://` when missing; remove "Mark progress" button
- **app/courses/new/page.tsx** — add `normalizeUrl()` to auto-prefix `https://` when missing
- **app/courses/[id]/progress/page.tsx** — delete (progress page removed)
- **app/api/courses/[id]/progress/route.ts** — delete (progress endpoint removed)
- **app/api/lessons/[id]/progress/route.ts** — delete (progress endpoint removed)
- **types/index.ts** — remove `LessonProgress` type
- **modules/course-content/index.ts** — remove `progressSchema`
- **supabase/migrations/00015_drop_lesson_progress.sql** — new migration: `DROP TABLE "LESSON_PROGRESS"`
- **test/course-content.test.ts** — remove `progressSchema` and `LessonProgress` tests (168 tests, 16 in course-content)

### refactor: remove separate remove-resource button — delete lesson already cleans up storage

- **app/courses/[id]/page.tsx** — remove `handleRemoveResource` and the separate "Remove resource" button (the lesson DELETE handler already deletes storage files)
- **app/courses/new/page.tsx** — same removal
- **app/api/lessons/[id]/resource/route.ts** — delete (no longer needed)

### fix: allow null content_url in lessons, show API errors, add remove-resource button

- **supabase/migrations/00014_allow_null_content_url.sql** — new migration: `ALTER TABLE "LESSONS" ALTER COLUMN content_url DROP NOT NULL`
- **modules/course-content/index.ts** — allow `content_url` to be `null` in `lessonSchema` (nullable + optional)
- **app/api/lessons/[id]/route.ts** — differentiate `undefined` (don't update) from `null` (clear) in PATCH handler
- **app/api/lessons/[id]/resource/route.ts** — new DELETE endpoint to remove a lesson's uploaded resource (deletes storage files, sets content_url to null)
- **app/courses/[id]/page.tsx** — show API error messages when lesson creation fails; add "Remove resource" button on lesson rows; hide View button when no content_url
- **app/courses/new/page.tsx** — same error handling and remove-resource button

### feat: add drag-and-drop reordering for modules and lessons

- **app/courses/[id]/page.tsx** — add drag-and-drop for module cards and lesson rows using native HTML Drag and Drop API; on drop, reorder locally and auto-save via PATCH API calls for all affected items
- **app/courses/new/page.tsx** — same drag-and-drop reordering for curriculum builder during course creation

### feat: remove lesson units and redundant pages; simplify progress to binary

- **app/courses/[id]/modules/[moduleId]/page.tsx** — delete (redundant with inline curriculum builder on detail page)
- **app/courses/[id]/lessons/[lessonId]/page.tsx** — delete (redundant with lesson-viewer component)
- **app/courses/[id]/page.tsx** — remove "Edit" navigation button pointing to deleted modules page; change "View" button on lesson rows to open content URL directly
- **supabase/migrations/00013_remove_lesson_units.sql** — new migration: `ALTER TABLE "LESSONS" DROP COLUMN total_units`, `ALTER TABLE "LESSON_PROGRESS" DROP COLUMN units_completed`
- **types/index.ts** — remove `total_units` from `Lesson`, remove `units_completed` from `LessonProgress`
- **modules/course-content/index.ts** — remove `total_units` from `lessonSchema`; change `progressSchema` to `{ is_completed: z.boolean() }`
- **app/api/lessons/[id]/route.ts** — remove `total_units` from PATCH update
- **app/api/modules/[id]/lessons/route.ts** — remove `total_units` from INSERT
- **app/api/lessons/[id]/progress/route.ts** — simplify to accept `is_completed: boolean` instead of `units_completed` with total_units validation
- **app/courses/[id]/progress/page.tsx** — simplify display: show ✓ or — instead of `units_completed / is_completed`
- **app/courses/new/page.tsx** — remove `total_units` from local interface and lesson create payload
- **components/lesson-viewer.tsx** — remove `total_units` from interface
- **app/events/[id]/live/page.tsx** — remove `total_units` from interface
- **test/course-content.test.ts** — update to 21 tests: remove `total_units`/`units_completed` assertions, add binary progress schema tests

### feat: restrict course access to facilitators and unify course page design language

- **app/api/courses/route.ts** — add `requireRole("facilitator")` to GET handler to restrict course listing
- **app/api/courses/[id]/route.ts** — add `requireRole("facilitator")` to GET handler for course detail
- **app/api/lessons/[id]/route.ts** — add `requireRole("facilitator")` to GET handler for lesson detail
- **app/api/courses/[id]/progress/route.ts** — change from `requireRole("attendee", "facilitator")` to `requireRole("facilitator")`; remove dead attendee branch
- **app/events/[id]/page.tsx** — hide "View Curriculum" button behind `userRole === "facilitator"`
- **app/courses/page.tsx** — restyle with `bg-[#FBF9F8]`, `max-w-[896px]`, styled list items, "ALL COURSES" header, edit/delete on hover per-row, Quick Create dialog
- **app/courses/[id]/page.tsx** — restyle course detail as curriculum builder with inline module rename (pencil icon), lesson dialog with file upload/URL inputs matching create page, course name/description edit dialog, unified design language
- **app/courses/new/page.tsx** — add file upload input to lesson dialog; auto-detect content type from uploaded file MIME type or URL extension; remove manual content type dropdown; show file upload and URL inputs simultaneously with mutual exclusion; disable submit until lesson name + (file or URL) provided

### feat: rewrite Create Course page with inline curriculum builder

- **app/courses/new/page.tsx** — replace simple title+description form with full curriculum builder; two-column form grid (title + description); "Add module" creates modules via API with auto-incrementing names; inline module rename (pencil icon toggles input, saves on Enter/blur via PATCH); "Add lesson to topic" opens dialog with lesson name, content type select, and optional content URL; lesson rows display sequence number, description, and content type badge; delete controls for modules and lessons; auto-creates course on first module add if not yet saved; redirects to course detail on submit

### feat: restyle attendance kiosk page to match design system

- **app/kiosk/page.tsx** — replace manual event ID input with fetched event picker (title, date/time, venue, status badge) using `GET /api/events?filter=upcoming`; restyle all views with Tailwind utility classes and light theme tokens; add top branding bar ("StartupLab — Kiosk mode") with selected event name; increase all touch targets to minimum 48px; add camera scanner with dashed QR frame overlay, manual input section, and styled result feedback cards (green/amber/red); keep all existing functionality (camera, BarcodeDetector, manual submit, checkin API)

### feat: add session status, start/end session controls, storage cleanup, and image proxy

- **supabase/migrations/00012_add_session_status.sql** — add `session_status` column (`scheduled`, `live`, `ended`) to `LIVE_SESSION_STATE`
- **types/index.ts** — add `SessionStatus` type and `session_status` field to `LiveSessionState`
- **app/api/live/[eventId]/state/route.ts** — set `session_status = 'live'` on init, `'scheduled'` on reset
- **app/api/live/[eventId]/route.ts** — set `session_status = 'live'` when selecting a lesson
- **app/events/[id]/live/page.tsx** — show "Session not started" for non-facilitators before session is live; add "Start Session" button with early-start warning; add "End Session" button; live indicator; elapsed timer only runs when live
- **app/events/[id]/page.tsx** — fetch session state; show "Start event session" (green, no navigation) for facilitators when session is not live; show "Enter event session" (blue) for all authorized users when live; hide Register for facilitators/speakers; delete modal requires typing "understood" when event has payments; simple confirm when no payments; modal uses `bg-white` for solid background
- **app/api/events/[id]/route.ts** — remove payment delete restriction; cascade delete tickets → payments → event; include `payment_count` in GET response for facilitators; clean up event image and linked course assets/videos from storage on delete
- **app/api/courses/[id]/route.ts** — clean up course assets/videos from storage on delete
- **app/api/modules/[id]/route.ts** — clean up lesson assets/videos from storage on delete
- **app/api/lessons/[id]/route.ts** — clean up lesson assets/videos from storage on delete
- **app/api/speakers/[id]/route.ts** — clean up profile image from storage on delete
- **app/api/auth/route.ts** — clean up profile image from storage on user deletion
- **lib/storage/index.ts** — add `deleteFromStorage`, `listStorageFolder`; switch `uploadToStorage` from `getPublicUrl` to proxy URL
- **app/api/storage/[bucket]/[...path]/route.ts** — new image proxy that serves files from Supabase storage using the service role key
- **components/event-card.tsx** — add `coverImageUrl` prop; render cover image with gradient fallback and dark overlay for text readability
- **app/events/page.tsx** — pass `cover_image_url` to EventCard
- **test/live-session.test.ts** — update tests for `session_status` field

### feat: add debug payment bypass for testing without HitPay

- **app/api/payments/route.ts** — when `NEXT_PUBLIC_DEBUG_BYPASS_PAYMENT=true`, skip HitPay call and directly mark payment as paid + issue ticket; also handles existing pending payments
- **DEBUG-PAYMENT-BYPASS.md** — new file documenting the debug bypass for agent context

### fix: re-route to checkout for pending payments instead of blocking

- **app/api/events/[id]/register/route.ts** — return `pending_payment_id` with 200 instead of 409 when a pending payment exists, so the user can be re-routed to the checkout page to poll for status
- **app/api/payments/route.ts** — return existing `payment_id` instead of 409 when a pending payment exists, so the register page can redirect to checkout
- **app/events/[id]/register/page.tsx** — handle `pending_payment_id` from both the register API and payments API by redirecting to `/checkout/{id}?success=true`; redesign with gradient header card, event info, user info display, terms checkbox, and styled buttons matching the design system

### feat: add Tickets navbar item, redesign tickets page, simplify register flow

- **components/navbar.tsx** — add "Tickets" nav item with confirmation_number icon for attendee role
- **app/tickets/page.tsx** — redesign with gradient card layout, event info (date/venue), status badge, QR code display, and empty state with "Browse events" CTA
- **app/events/[id]/page.tsx** — simplify register button to always route to `/events/{id}/register` for authenticated users, or to `/sign-in` for unauthenticated; remove inline API call logic

### feat: redesign event detail page with design system layout

- **app/events/[id]/page.tsx** — complete rewrite: gradient hero with cover image support, two-column layout (1.5fr main + 1fr sidebar), status badge, date/time/venue icons, speakers list with avatars, linked curriculum card, scheduling sidebar card, venue sidebar card, role-aware actions (register for attendees, publish/edit/delete for facilitators), role fetched from `/api/auth/me`

### refactor: unify EventCard design and filter landing to active events only

- **components/event-card.tsx** — rewrite with gradient header, frosted glass badge, icon rows, and "View details" link matching landing page design; props now accept raw status string, start/end times, venue name, course name, and accent index
- **lib/landing.ts** — `getUpcomingEvents()` now filters to `status=active` only, returns max 2 events
- **app/page.tsx** — inline event card markup replaced with `<EventCard>` component
- **app/events/page.tsx** — replaced old `EventCard` usage with new gradient-based component; removed `mapStatus` helper and `StatusBadge` import
- **test/landing.test.ts** — updated mock chainable to include `eq` method; added assertions for active-only filter and limit(2)

### refactor: replace static landing page data with live Supabase queries

- **lib/landing.ts** — rewrite from static event array to `getUpcomingEvents()` server helper querying Supabase; add `formatEventDate`, `formatTime`, `eventStatusLabel`, `accentClass` helpers
- **app/page.tsx** — convert to async server component calling `getUpcomingEvents()`; hero section uses first upcoming event; event cards link to `/events/:id`; empty state when no events exist
- **test/landing.test.ts** — rewrite to test extracted helpers (formatEventDate, formatTime, eventStatusLabel, accentClass) and getUpcomingEvents with mocked Supabase

### feat: add delete event option for facilitators

- **components/event-card.tsx** — add `onDelete` callback prop; render delete icon button in card footer when facilitator
- **app/events/page.tsx** — add `handleDelete` calling `DELETE /api/events/:id`, remove event from list on success; pass `onDelete` to EventCard for facilitators

- **public/fonts/** — download Inter (latin + latin-ext, normal + italic) and Material Symbols Rounded woff2 files
- **app/fonts.css** — new file with local `@font-face` declarations for Inter and Material Symbols Rounded (placed before Tailwind imports so they aren't stripped)
- **app/globals.css** — set `--font-sans` to `"Inter", system-ui, sans-serif`; add `.msr` / `.material-symbols-rounded` CSS classes
- **app/layout.tsx** — import `fonts.css` before `globals.css`; removed `next/font/google` and Google Fonts `<link>` tags

- **app/layout.tsx** — load Inter via `next/font/google` with `--font-inter` CSS variable; add Material Symbols Rounded link tag with `display=optional`
- **app/globals.css** — map `--font-sans` and `--font-heading` to `--font-inter`; add `.msr` and `.material-symbols-rounded` CSS classes for icon rendering

### fix: redirect post-login to /events and fix navbar role detection

- **app/sign-in/[[...sign-in]]/page.tsx** — add `afterSignInUrl="/events"` so users land on events after login
- **app/staff-login/[[...rest]]/page.tsx** — add `afterSignInUrl="/events"` for same redirect
- **components/navbar.tsx** — fetch role from `/api/auth/me` (Supabase) instead of `user.publicMetadata.role` (Clerk), which was never populated by the auth webhook

### chore: remove debug menu entirely and block non-staff from staff login

- **components/debug-menu.tsx** — delete debug menu component
- **DEBUG-REMOVAL.md** — delete removal instructions
- **app/layout.tsx** — remove DebugMenu import and rendering
- **middleware.ts** — remove debug_mode cookie bypass and unused NextResponse import
- **lib/auth/role-guard.ts** — remove debug_mode/debug_role cookie bypass logic
- **app/staff-login/[[...rest]]/page.tsx** — add server-side role check: redirect non-staff users (attendee) to /events

### feat: update debug menu with all pages and remove dashboard references

- **components/debug-menu.tsx** — remove dashboard from all role nav items, add tickets for attendee, add payments for facilitator, keep courses/new and events/new links

### feat: add event and course creation forms with design system styling

- **app/events/new/page.tsx** — rewrite with design system form patterns (labeled fields, file upload, currency select, error banner, back navigation)
- **app/courses/new/page.tsx** — new page with course name, description textarea, and cancel/create buttons
- **components/ui/textarea.tsx** — new Textarea component matching design system input styling

### feat: update navbar to light theme and unify across all pages

- **components/navbar.tsx** — restyle to light theme matching landing page design (white background, blue accent, material icons)
- **components/app-shell.tsx** — show navbar on all pages except auth routes; add left padding for sidebar offset
- **app/page.tsx** — remove inline sidebar (now provided by AppShell), use MarketingFooter shared component

### fix: update design system to light theme

- **design-system_2_1.html** — swap monochrome scale to light mode defaults, update surface role mappings, adjust shadow opacity for light backgrounds, update accent/semantic colors for light theme contrast

### feat: add universal navbar and shared design system components

- **components/navbar.tsx** — vertical sidebar navbar with role-based navigation items, brand logo, and user actions (avatar, sign out)
- **components/app-shell.tsx** — wrapper component that conditionally renders the navbar based on route (hidden on auth and landing pages)
- **components/marketing-footer.tsx** — marketing footer for user-facing pages with company info and links
- **components/utility-footer.tsx** — minimal utility footer for staff pages with copyright notice
- **components/event-card.tsx** — reusable event card with status badge, date/time, description, and action links
- **components/course-card.tsx** — reusable course card with thumbnail, title, and module count
- **components/resource-card.tsx** — resource card for files and links with type-specific icons and action buttons
- **components/status-badge.tsx** — status badge component with variants for live, active, upcoming, completed, draft, and pending states
- **components/toast.tsx** — toast notification component with success, error, and info variants
- **app/layout.tsx** — integrate AppShell wrapper to provide consistent navigation across all pages
- **app/events/page.tsx** — update to use EventCard component and filter tabs matching design system
- **app/courses/page.tsx** — update to use CourseCard component with grid layout

### feat: remove dashboard and redirect to events as facilitator landing

- **app/dashboard/** — remove dashboard pages (dashboard is replaced by events as the landing page for all roles)
- **middleware.ts** — remove dashboard from protected routes, add organization route protection
- **components/debug-menu.tsx** — update navigation items to reflect new route structure (events as landing, remove dashboard links)

### feat: add staff login page for facilitators and speakers

- **app/staff-login/[[...rest]]/page.tsx** — minimal centered login page with Clerk SignIn component, brand bolt icon, and design system styling
- **components/debug-menu.tsx** — add Staff Login to navigation items

### feat: add StartupLab landing page

- **app/page.tsx** — implement the Figma-inspired business center landing page with sign-in and sign-up entry points
### feat: add auth form pages with design system layout

- **components/auth-layout.tsx** — shared split layout component with brand panel (gradient) and mini-nav for auth pages
- **app/sign-in/[[...sign-in]]/page.tsx** — Clerk SignIn component styled with design system tokens, wrapped in AuthLayout
- **app/sign-up/[[...sign-up]]/page.tsx** — Clerk SignUp component styled with design system tokens, wrapped in AuthLayout

### feat: add debug menu for bypassing authentication during testing

- **components/debug-menu.tsx** — floating amber "D" button that enables debug mode, role selection (attendee/speaker/facilitator), quick nav to all routes
- **middleware.ts** — skip auth protection when `debug_mode` cookie is set
- **lib/auth/role-guard.ts** — bypass role checks when debug mode active, respect `debug_role` cookie for role selection
- **app/layout.tsx** — include DebugMenu component
- **DEBUG-REMOVAL.md** — documentation for removing debug menu before production

### feat: add Supabase Storage upload support across all buckets

- **lib/storage/index.ts** — new storage module: bucket configs, file type/size validation, upload helper, path builders for event_images, profile_images, course_assets, course_videos
- **app/api/upload/event-image/route.ts** — POST (facilitator-only) upload event cover image to `event_images` bucket, update EVENTS.cover_image_url
- **app/api/upload/profile-image/route.ts** — POST (authenticated) upload profile photo to `profile_images` bucket, update SPEAKER_PROFILES.photo_url
- **app/api/upload/course-asset/route.ts** — POST (facilitator-only) upload PDF/image to `course_assets` bucket, update LESSONS.content_url
- **app/api/upload/course-video/route.ts** — POST (facilitator-only) upload video to `course_videos` bucket, update LESSONS.content_url
- **types/index.ts** — add `profile_image_url: string | null` to User interface
- **modules/course-content/index.ts** — make `content_url` optional in lessonSchema (required when not uploading file)
- **app/events/new/page.tsx** — add file upload input for cover image alongside URL input
- **app/events/[id]/edit/page.tsx** — add file upload input for cover image with preview of current image
- **app/speakers/[id]/edit/page.tsx** — add file upload input for profile photo with preview of current photo
- **app/courses/[id]/modules/[moduleId]/page.tsx** — add file upload input for lesson content (PDF/image/video) with type-based file filter
- **test/storage.test.ts** — unit tests for file type validation, file size validation, extension mapping, path builders, and type shapes

### feat: add cover image URL support to events

- **types/index.ts** — add `cover_image_url: string | null` to Event interface
- **modules/event-management/index.ts** — add `cover_image_url` (URL, nullable) to eventBaseSchema
- **app/api/events/route.ts** — include `cover_image_url` in POST insert (defaults to null)
- **app/events/new/page.tsx** — add Cover Image URL input field to event creation form
- **app/events/[id]/page.tsx** — display cover image when `cover_image_url` is set
- **app/events/[id]/edit/page.tsx** — add Cover Image URL input field to event edit form
- **test/event-management.test.ts** — add tests for cover_image_url shape, valid URL, null, and invalid URL

### chore: initialize Supabase Storage buckets for application resources

- **Supabase Storage** — created the initial storage bucket structure for uploaded application resources
- **event_images** — public bucket for event cover images (`image/jpeg`, `image/png`)
  - Store object paths in `EVENTS.cover_image_path`
  - Upload convention: `events/{event_id}/cover.<ext>`
- **profile_images** — public bucket for attendee, speaker, facilitator, and administrator profile photos (`image/jpeg`, `image/png`)
  - Store object paths in `USERS.profile_image_path`
  - Upload convention: `users/{user_id}/profile.<ext>`
- **course_assets** — private bucket for PDFs, slides, spreadsheets, text files, ZIP archives, and images
  - Store object paths in `LESSONS.content_path` when `content_type` is a document or image
  - Upload convention: `courses/{course_id}/modules/{module_id}/lessons/{lesson_id}/{filename}`
- **course_videos** — private bucket for lesson videos (`video/mp4`, `video/webm`, `video/quicktime`, `video/x-msvideo`, `video/x-matroska`)
  - Store object paths in `LESSONS.content_path` when `content_type` is `video`
  - Upload convention: `courses/{course_id}/modules/{module_id}/lessons/{lesson_id}/{filename}`
- **Storage configuration** — each bucket currently has a 50 MB file size limit
- **Storage policies** — no bucket access policies have been configured yet; access control will be implemented in a future update

### feat: add email notification subsystem — Brevo client, EMAIL_LOGS, fire-and-forget triggers, facilitator log browser

- **supabase/migrations/00010_create_email_logs.sql** — new migration: `email_type` ENUM (`registration_confirmation`, `ticket_issued`, `check_in_confirmed`), `email_status` ENUM (`sent`, `failed`), `EMAIL_LOGS` table with user_id FK, indexes on user_id, email_type, status, sent_at
- **types/index.ts** — add `EmailType`, `EmailStatus`, `EmailLog` interface
- **modules/notifications/index.ts** — domain logic: `emailTypeEnum`, `emailStatusEnum`, `emailLogInsertSchema`, `emailLogFilterSchema`
- **modules/notifications/email.ts** — `fireAndForgetEmailNotification()` utility: sends Brevo email via `Promise.allSettled`, inserts `EMAIL_LOGS` row with `sent` or `failed` status, non-blocking from API handler
- **lib/email/index.ts** — Brevo client wrapper: `sendEmail()` calling `/v3/smtp/email`, inline HTML templates for registration confirmation, ticket issued, and check-in confirmed emails
- **app/api/payments/route.ts** — wire `registration_confirmation` email trigger after payment creation (fire-and-forget)
- **app/api/payments/webhook/route.ts** — wire `ticket_issued` email trigger after ticket creation (fire-and-forget)
- **app/api/checkin/route.ts** — replace placeholder EMAIL_LOGS insert with `check_in_confirmed` email trigger via fire-and-forget
- **app/api/logs/route.ts** — GET (facilitator-only) list email logs with filtering by `email_type`, `status`, `user_id`, date range; sorted by `sent_at` descending
- **app/api/logs/[id]/route.ts** — GET (facilitator-only) single email log detail with user join
- **app/dashboard/logs/page.tsx** — facilitator email log browser: table (user, email, type, status, sent_at), filters by type dropdown, status dropdown, date range
- **test/notifications.test.ts** — 22 unit tests for EmailLog type shape, emailTypeEnum, emailStatusEnum, emailLogInsertSchema, emailLogFilterSchema

### fix: align dynamic route slug names to resolve Next.js conflict ('id' !== 'eventId')

- **app/api/events/[eventId]/surveys/route.ts** — merged into `[id]/surveys/`, renamed param from `eventId` to `id` to match sibling route segments under `app/api/events/`
- **app/kiosk/[eventId]/attendees/page.tsx** — renamed to `[id]/attendees/`, updated `params.eventId` → `params.id`

### feat: add survey subsystem — facilitator builder, attendee submission, response browsing

- **supabase/migrations/00009_create_surveys.sql** — new migration: SURVEYS, SURVEY_QUESTIONS (with submitted_type enum), SURVEY_RESPONSES (UK on survey_id+user_id), SURVEY_ANSWERS tables with FKs, indexes, and cascading deletes
- **modules/surveys/index.ts** — domain logic: `surveyCreateSchema`, `surveyUpdateSchema`, `questionSchema`, `questionUpdateSchema`, `responseSubmitSchema`, `validateAnswers()` enforcing rating 1-5, text presence, and one-answer-per-question
- **app/api/events/[eventId]/surveys/route.ts** — GET (attendee: available with already_submitted flag; facilitator: all) and POST (facilitator-only) survey CRUD
- **app/api/surveys/[id]/route.ts** — GET (survey with questions), PATCH (title update), DELETE (cascading) — all facilitator-only except GET
- **app/api/surveys/[id]/questions/route.ts** — POST add question (facilitator)
- **app/api/surveys/[id]/questions/[questionId]/route.ts** — PATCH and DELETE question (facilitator)
- **app/api/surveys/[id]/responses/route.ts** — POST submit response (attendee, 409 on duplicate, validates answers); GET list responses (facilitator)
- **app/api/surveys/[id]/responses/[responseId]/route.ts** — GET single response with answers (facilitator)
- **app/events/[id]/surveys/page.tsx** — survey list screen (facilitator: manage/delete; attendee: take or already-submitted)
- **app/events/[id]/surveys/new/page.tsx** — survey builder with add/edit/remove questions and type selection
- **app/events/[id]/surveys/[surveyId]/edit/page.tsx** — edit survey title, add/edit/delete questions
- **app/events/[id]/surveys/[surveyId]/page.tsx** — attendee survey form rendering text/multiple-choice/rating inputs with validation
- **app/events/[id]/surveys/[surveyId]/confirmed/page.tsx** — post-submit confirmation screen
- **app/events/[id]/surveys/[surveyId]/responses/page.tsx** — facilitator response browser with expandable individual responses
- **test/surveys.test.ts** — 15 unit tests for schemas and answer validation

### feat: add kiosk check-in flow with QR scanning and real-time attendee list

- **supabase/migrations/00008_enable_tickets_realtime.sql** — enable Realtime publication on TICKETS table for check-in list updates
- **modules/kiosk/index.ts** — domain logic: `checkinSchema` (qr_token validation), `formatCheckinResult()` returning success/duplicate/rejected discriminated result
- **lib/realtime/index.ts** — `subscribeToCheckins()` utility subscribing to TICKETS UPDATE events filtered by event_id; fires only when status=checked_in
- **app/api/checkin/route.ts** — POST (facilitator-only) looks up ticket by qr_token, validates status transitions (issued→checked_in), returns success with attendee info, duplicate for already-checked-in, or rejected for cancelled tickets
- **app/api/checkin/[eventId]/attendees/route.ts** — GET (facilitator-only) returns list of checked-in attendees with name, email, and check-in time
- **app/kiosk/page.tsx** — full-screen kiosk page: event picker, camera scanner via getUserMedia + BarcodeDetector (native API), manual QR token text input fallback, result overlay with auto-clear after 3s
- **app/kiosk/[eventId]/attendees/page.tsx** — checked-in attendee table with real-time updates via subscribeToCheckins()
- **middleware.ts** — protect `/kiosk(.*)` routes behind authentication
- **test/kiosk.test.ts** — 8 unit tests for checkinSchema and formatCheckinResult

### feat: add chat subsystem — Q&A and support channels with real-time sync

- **supabase/migrations/00007_create_chat_messages.sql** — new migration: CHAT_MESSAGES table with message_id PK, event_id FK, channel enum, user_id FK, message, sent_at, read_by, deleted_at, updated_at; index on (event_id, channel, sent_at DESC); enable Realtime publication
- **types/index.ts** — add `ChatChannel` type and `ChatMessage` interface with soft-delete support
- **modules/chat/index.ts** — domain logic: `chatChannelEnum`, `sendMessageSchema` with 1-1000 char validation, `isRateLimited()` checker, `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX` constants
- **lib/realtime/index.ts** — `subscribeToChatMessages()` utility wrapping Supabase Realtime channel with per-event, per-channel filtered INSERT subscription; client-side channel filter ensures only matching channel messages appear
- **app/api/chat/[eventId]/route.ts** — GET (all authenticated) returns paginated messages (cursor-based, 50 per page, filtered by channel, excluding soft-deleted); POST (all authenticated) sends message with rate limiting (5/10s per user per channel) and draft-event access control
- **app/api/chat/[eventId]/[messageId]/route.ts** — DELETE (facilitator-only) soft-deletes message by setting deleted_at
- **components/chat-panel.tsx** — reusable chat UI component: message list with auto-scroll-to-bottom (respects manual scroll-up), load-more pagination, message input with send, delete button for facilitators, real-time subscription for new messages
- **app/events/[id]/support/page.tsx** — standalone support channel page scoped to channel=support
- **app/events/[id]/live/page.tsx** — replace Q&A and support chat placeholders with live ChatPanel instances; track currentUserId for client-side use
- **test/chat.test.ts** — 15 unit tests for ChatChannel type, ChatMessage type, chatChannelEnum, sendMessageSchema, and isRateLimited

### feat: add live session room with real-time lesson broadcast

- **supabase/migrations/00006_create_live_session_state.sql** — new migration: LIVE_SESSION_STATE table (event_id PK/FK, current_lesson_id FK nullable, updated_by FK, updated_at); enable Realtime publication
- **types/index.ts** — add `LiveSessionState` interface
- **modules/live-session/index.ts** — domain logic: `liveSessionUpdateSchema` for PATCH validation; `validateLessonBelongsToEvent` guard checking lesson is in event's course module tree
- **lib/realtime/index.ts** — `subscribeToLiveSession()` utility wrapping Supabase Realtime channel with per-event filtered subscription
- **components/lesson-viewer.tsx** — reusable lesson content renderer extracted from course viewer (pdf/video/image/link)
- **app/api/live/[eventId]/route.ts** — GET (all roles) returns current session state; PATCH (speaker/facilitator) updates current_lesson_id with server-side validation
- **app/api/live/[eventId]/state/route.ts** — POST (facilitator-only) initialize or reset session state
- **app/api/auth/me/route.ts** — new endpoint returning current user's `user_id` and `role` for client-side role detection
- **app/events/[id]/live/page.tsx** — live room page with speaker controls (prev/next/dropdown), attendee lesson viewer, Q&A placeholder, support chat placeholder; real-time sync via Supabase Realtime with 10s polling fallback

### feat: add event status lifecycle (draft → active → complete)

- **supabase/migrations/00004_create_commerce.sql** — merge price/currency ALTER TABLE from `docs/update_table_include_price.sql` into PAYMENTS table; add amount/currency columns and CHECK constraints
- **supabase/migrations/00005_create_event_status.sql** — new migration: `event_status` enum, `status` column on EVENTS (default `draft`), index
- **types/index.ts** — add `EventStatus` type, `status` field to Event interface
- **modules/event-management/index.ts** — add `status` (enum optional) to eventBaseSchema
- **app/api/events/route.ts** — POST inserts with `status: "draft"`; GET filters out `draft` events for non-facilitators
- **app/api/events/[id]/route.ts** — GET returns 404 on `draft` for non-facilitators
- **app/api/events/[id]/publish/route.ts** — new endpoint: facilitator-only `draft → active` transition
- **app/api/events/[id]/register/route.ts** — GET and POST reject draft events for non-facilitators (defense in depth)
- **app/api/payments/route.ts** — POST rejects draft events (defense in depth)
- **app/events/[id]/page.tsx** — show status badge; show "Publish" button when draft with optimistic UI update
- **app/events/[id]/edit/page.tsx** — add status select dropdown (draft/active/complete)
- **context/OVERVIEW.md** — add `status ENUM(draft,active,complete)` to EVENTS row
- **context/data-model.md** — add status field, event_status enum, validation rules, index
- **context/functional-planning.md** — add facilitator stories for publish/complete; add draft visibility to permission matrix; add business rules 9–14 for event status
- **context/architecture.md** — note status in Event Management module
- **context/scope.md** — mention draft→active→complete lifecycle
- **context/ux-screens.md** — add status field to form requirements; add publish action to Event Detail permissions
- **context/spec/03-event-management-spec.md** — add status column, publish endpoint, draft filtering, lifecycle rules
- **test/event-management.test.ts** — add `status` to Event interface test; add schema tests for valid/invalid status values

### fix: Zod 4 forbids .partial() on schemas with .refine() — split eventSchema into base + partial

- **modules/event-management/index.ts** — extract `eventBaseSchema` (no refine) and derive `eventPartialSchema` (partial of base) from it, so PATCH handler avoids calling `.partial()` on a refined schema
- **app/api/events/[id]/route.ts** — import and use `eventPartialSchema` instead of `eventSchema.partial()`

### feat: add price/currency fields to event create/edit forms

- **modules/event-management/index.ts** — remove `.default()` from `price`/`currency` in eventSchema so PATCH doesn't silently overwrite omitted fields; fallback defaults applied at POST handler and DB level
- **app/api/events/route.ts** — include `price`/`currency` in the POST insert mapping (defaulting to 0 and "PHP")
- **app/events/new/page.tsx** — add Price (number, min 0) and Currency (uppercased 3-char) inputs
- **app/events/[id]/edit/page.tsx** — load and save price/currency; add Price and Currency inputs

### docs: reflect event pricing fields across all planning documents

- **OVERVIEW.md** — add `price`/`currency` to EVENTS row, `amount`/`currency` to PAYMENTS row, pricing model note (amount snapshotted from event at creation)
- **data-model.md** — EVENTS and PAYMENTS entity specs with `price`/`amount`/`currency` fields and CHECK constraints; add 4 pricing validation rules
- **scope.md** — facilitator role includes pricing; event management workflow mentions price; success criteria updated
- **functional-planning.md** — add facilitator story for setting price/currency; add "Set event price/currency" to permission matrix; add business rules 7-8 for price non-negativity and amount snapshot
- **architecture.md** — note price/currency on EVENTS module and amount/currency on PAYMENTS module
- **ux-screens.md** — add Price and Currency fields to Event Create/Edit form; update Payment Status per-role actions to include amount

### fix: snapshot event price/currency into payments instead of hardcoding 0/SGD

- **types/index.ts** — add `price`/`currency` to Event, `amount`/`currency` to Payment
- **modules/event-management/index.ts** — add `price` (min 0) and `currency` (3-char, default PHP) to eventSchema
- **app/api/payments/route.ts** — fetch `EVENTS.price`/`currency` at payment creation; snapshot into `PAYMENTS.amount`/`currency` on insert; pass actual amount/currency to HitPay
- **app/api/events/[id]/register/route.ts** — include `price`/`currency` in registration data response
- **context/spec/04-commerce-spec.md** — add pricing note documenting the snapshot behavior
- **test/event-management.test.ts** — update Event interface test to include `price`/`currency`

### feat: add commerce pipeline — HitPay payments, tickets, QR codes

- **supabase/migrations/00004_create_commerce.sql** — PAYMENTS and TICKETS tables with status enums, FK constraints, and indexes
- **types/index.ts** — add Payment, Ticket, PaymentStatus, TicketStatus interfaces
- **modules/commerce/index.ts** — paymentInitSchema, status transition guards, QR token generation, terminal state check
- **lib/hitpay/index.ts** — HitPay API client (createPayment, verifyWebhookSignature with HMAC)
- **lib/qr/index.ts** — QR code generation as data URL via `qrcode` package
- **app/api/payments/route.ts** — POST initiate payment (creates PAYMENTS record, returns HitPay checkout URL); GET list payments (attendee: own; facilitator: all)
- **app/api/payments/[id]/route.ts** — GET payment status with role-based access
- **app/api/payments/webhook/route.ts** — POST HitPay webhook receiver (HMAC validation, idempotent, issues ticket on paid)
- **app/api/tickets/route.ts** — GET list tickets with event details
- **app/api/tickets/[paymentId]/route.ts** — GET ticket with QR data URL
- **app/api/events/[id]/register/route.ts** — GET registration page data; POST validate eligibility + duplicate check
- **app/events/[id]/register/page.tsx** — registration page with terms agreement and payment redirect
- **app/checkout/[paymentId]/page.tsx** — checkout status page polling payment until resolution
- **app/tickets/page.tsx** — attendee ticket wallet with QR code display
- **app/payments/page.tsx** — payment status list (attendee: own; facilitator: all)
- **middleware.ts** — exclude `/api/payments/webhook` from auth protection (public endpoint)
- **package.json** — add `qrcode` and `@types/qrcode` dependencies
- **.env.local** — add HitPay sandbox configuration variables
- **test/commerce.test.ts** — 24 unit tests for types, schemas, status transitions, token generation

### fix: repair speaker assignment page and public event API access

- **middleware.ts** — exclude `/api/events` and `/api/speakers` from auth protection; public GET routes handled at route level
- **app/api/speakers/route.ts** — add explicit `requireRole("facilitator")` to GET handler (previously relied on middleware)
- **app/api/events/[id]/speakers/route.ts** — add `requireRole("facilitator")` to GET handler
- **app/events/[id]/speakers/page.tsx** — fix `loadAll()` reference error (function inlined during lint fix lost the name); use refresh-key pattern to avoid lint warnings

### feat: add event management and speaker assignment

- **supabase/migrations/00003_create_event_management.sql** — EVENTS, SPEAKER_PROFILES, EVENT_SPEAKERS tables with CHECK constraint, indexes, and cascade rules
- **types/index.ts** — add Event and SpeakerProfile interfaces
- **modules/event-management/index.ts** — Zod schemas for events, speaker profiles, and speaker assignments
- **app/api/events/** — CRUD routes with facilitator guards, event delete checks for existing payments
- **app/api/speakers/** — list/create speaker profiles (facilitator); PATCH allows self-service edit
- **app/api/events/[id]/speakers/** — assign/remove speakers from events
- **app/events/** — public event list (filterable by upcoming/past), event detail page, create/edit forms
- **app/speakers/** — speaker profile list, edit page
- **app/events/[id]/speakers/** — speaker assignment UI (assign/remove)
- **test/event-management.test.ts** — 14 unit tests for schemas and type shapes

### feat: add missing course content screens (module editor, lesson viewer, progress)

- **app/courses/[...]/modules/[...]/page.tsx** — module/lesson editor with create, edit, delete for lessons
- **app/courses/[...]/lessons/[...]/page.tsx** — lesson viewer rendering pdf/video/image/link content with progress tracking
- **app/courses/[...]/progress/page.tsx** — progress overview table (facilitator: all attendees; attendee: own)

### feat: add auth foundation — Clerk, Supabase, shadcn/ui, role guards

- **middleware.ts** — clerkMiddleware enforcing authentication on all protected routes; role checks deferred to API route guards
- **lib/db/index.ts** — Supabase typed client with anonymous and service-role clients
- **lib/auth/role-guard.ts** — `requireRole(...)` helper for API routes and server components
- **types/index.ts** — shared `User` and `UserRole` TypeScript interfaces
- **app/api/auth/route.ts** — Clerk webhook endpoint syncing user.created/updated/deleted to `USERS` table
- **app/layout.tsx** — wrap root with `<ClerkProvider>`
- **app/sign-in/** and **app/sign-up/** — Clerk-hosted auth pages
- **app/dashboard/** — facilitator-only page with role guard returning 403 for non-facilitators
- **supabase/migrations/00001_create_users.sql** — USERS table migration with role enum, indexes, and audit fields
- **components/ui/** — shadcn/ui primitives: button, input, card, label, select, dialog, form
- **test/foundation.test.ts** — unit tests for role guard and User type shape
- **package.json** — add @clerk/nextjs, @supabase/supabase-js, svix, react-hook-form, @hookform/resolvers, zod

### chore: resolve spec gaps before implementation handoff

- **AGENTS.md** — add vitest testing instructions
- **context/architecture.md** — document Supabase Realtime per-table setup requirement
- **context/spec/01-foundation-spec.md** — middleware now auth-only (role checks deferred to API route guards); add Realtime config to foundation scope
- **context/spec/05-live-session-spec.md** — add Realtime prerequisite on `LIVE_SESSION_STATE`
- **context/spec/06-chat-spec.md** — add Realtime prerequisite on `CHAT_MESSAGES`
- **context/spec/07-kiosk-spec.md** — add Realtime prerequisite on `TICKETS`
- **package.json** — add vitest dependency and `test` script
- **vitest.config.ts** — new file, vitest config with React plugin and `@/` alias

### docs: add planning documents (Phases 1-4)

- `a133d23` **scope.md** — MVP scope, user roles, feature boundaries, and out-of-scope items
- `69c7de7` **functional-planning.md** — user stories for every role-to-system interaction, organized by workflow
- `1863661` **architecture.md** — module ownership, module-to-entity mapping, technology choices, and key dependencies
- `c0e673c` **data-model.md** — finalized schema definitions for every entity, field types, constraints, and relationships
- `e3a865c` **ux-screens.md** — screen inventory by module, route design, role-based access, and UI mockups

### docs: tighten context files for code generation precision

- **OVERVIEW.md**: spell out `role` enum values (`attendee | speaker | facilitator`); define `LESSONS.content_type` as `ENUM(pdf, video, image, link)` with descriptions
- **phase-0.md** to **phase-8.md**: add explicit output file paths so agents write to a known location
- **phase-6.md**: fix `context/specs/` → `context/spec/` to match Phase 5's output directory
- **phase-5.md**: align `context/specs/` → `context/spec/` for consistency

### docs: add descriptions to reference files in Phase 5 build planning

- `e85ca32` **phase-5.md**: add one-line descriptions to each referenced planning document so agents can quickly identify which file to consult for scope, workflows, architecture, schema, or screens

### feat: create 9 build spec sheets for Phase 5 implementation planning

- **01-foundation-spec.md** — Auth + user/role model with Clerk, Supabase client, shadcn/ui, and role-based middleware
- **02-course-content-spec.md** — Course/Module/Lesson CRUD + progress tracking for attendees
- **03-event-management-spec.md** — Event CRUD + speaker profiles + speaker assignment
- **04-commerce-spec.md** — HitPay checkout → payment webhook → ticket/QR issuance
- **05-live-session-spec.md** — Live session state model + real-time broadcast via Supabase Realtime
- **06-chat-spec.md** — Q&A + support chat channels with real-time sync
- **07-kiosk-spec.md** — Kiosk check-in flow with QR scan/verify
- **08-surveys-spec.md** — Survey CRUD + response submission
- **09-notifications-spec.md** — Email logs + Brevo transactional send
