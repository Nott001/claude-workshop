export type UserRole = "attendee" | "speaker" | "facilitator" | "admin" | "super_admin";
export type SupportType = "general" | "event";

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
  created_by: number | null;
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
  created_at: string;
  updated_at: string;
}

export interface Lesson {
  id: number;
  module_id: number;
  description: string;
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
  event_id: number | null;
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
  deleted_at: string | null;
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
  | "lesson.deleted";

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
  event_id: number;
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
  event_id: number | null;
  created_at: string;
  updated_at: string;
}

export type EmailType = "ticket_issued" | "check_in_confirmed";
export type EmailStatus = "sent" | "failed";

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
