export type UserRole = "attendee" | "speaker" | "facilitator" | "admin" | "super_admin";
/** Support chat is general-only; the event branch was removed. */
export type SupportType = "general";

export interface User {
  id: number;
  full_name: string;
  email: string;
  auth_user_id: string;
  role: UserRole;
  profile_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export type ContentType = "pdf" | "video" | "image" | "link";

export type ModuleType = "lessons" | "qa";

export interface Course {
  id: number;
  event_id: number;
  course_name: string;
  course_description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Module {
  id: number;
  course_id: number;
  module_name: string;
  sequence_order: number;
  module_type: ModuleType;
  is_locked: boolean;
  start_time: string | null;
  end_time: string | null;
  speaker_profile_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface Lesson {
  id: number;
  module_id: number;
  name: string;
  description: string | null;
  content_type: ContentType;
  content_url: string | null;
  sequence_order: number;
  created_at: string;
  updated_at: string;
}

export type EventStatus = "draft" | "active" | "complete";

export interface Event {
  id: number;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue_address: string | null;
  venue_name: string;
  description: string | null;
  price: number;
  currency: string;
  cover_image_url: string | null;
  status: EventStatus;
  survey_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface SpeakerProfile {
  id: number;
  user_id: number;
  bio: string | null;
  designation: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  github_url: string | null;
  website_url: string | null;
  created_at: string;
  updated_at: string;
}

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type TicketStatus = "issued" | "checked_in" | "cancelled";

export interface Payment {
  id: number;
  user_id: number;
  event_id: number;
  gateway_reference_id: string | null;
  status: PaymentStatus;
  paid_at: string | null;
  amount: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  id: number;
  payment_id: number;
  user_id: number;
  event_id: number;
  qr_token: string;
  status: TicketStatus;
  issued_at: string;
  checked_in_by: number | null;
  checked_in_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  session_id: number | null;
  support_type: SupportType;
  user_id: number;
  recipient_user_id: number | null;
  message: string;
  sent_at: string;
  deleted_at: string | null;
  updated_at: string;
}

export interface QaMessage {
  id: number;
  event_id: number;
  module_id: number;
  user_id: number;
  message: string;
  created_at: string;
  updated_at: string;
}

export type AuditAction =
  | "event.created"
  | "event.updated"
  | "event.deleted"
  | "event.published"
  | "speaker.assigned"
  | "speaker.unassigned"
  | "organization.invited"
  | "organization.role_changed"
  | "organization.removed"
  | "checkin.performed"
  | "course.created"
  | "course.updated"
  | "course.deleted"
  | "module.created"
  | "module.updated"
  | "module.deleted"
  | "lesson.created"
  | "lesson.updated"
  | "lesson.deleted"
  | "auth.password_reset_completed";

export interface AuditLog {
  id: number;
  actor_id: number;
  action: AuditAction;
  entity_type: string;
  entity_id: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface LiveSessionState {
  course_id: number;
  highlighted_lesson_id: number | null;
  updated_by: number;
  updated_at: string;
}

export type SupportSessionStatus = "active" | "ended_by_facilitator";

export interface SupportSession {
  id: number;
  user_id: number;
  status: SupportSessionStatus;
  support_type: SupportType;
  case_number: number;
  assigned_to: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Tuples rather than bare unions: the runtime needs the member list too, for
 * the zod filter schema and the staff filter dropdowns. Deriving the type from
 * the tuple keeps one declaration where a PG enum change has to land.
 */
export const EMAIL_TYPES = ["ticket_issued", "check_in_confirmed", "event_survey"] as const;
export type EmailType = (typeof EMAIL_TYPES)[number];

export const EMAIL_STATUSES = ["sent", "failed"] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

export interface EmailLog {
  id: number;
  user_id: number;
  email_type: EmailType;
  status: EmailStatus;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LandingEvent {
  event_id: number;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  status: string;
  course_name: string | null;
  cover_image_url: string | null;
}

/** A community group card shown on /community, managed by admins. */
export interface CommunityLink {
  id: number;
  label: string;
  url: string;
  description: string | null;
  icon_url: string | null;
  sequence_order: number;
  is_hidden: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * One post-event survey per event, created when the bulk send runs. `sent_at`
 * anchors the 14-day expiry/retry window for every recipient.
 */
export interface Survey {
  id: number;
  event_id: number;
  sent_at: string;
  created_at: string;
  updated_at: string;
}

/** One row per recipient. The token is the attendee's link into the form. */
export interface SurveyResponse {
  id: number;
  survey_id: number;
  user_id: number;
  token: string;
  /** Set when that recipient's email actually delivered; retries key off null. */
  sent_at: string | null;
  submitted_at: string | null;
  rating: number | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
}
