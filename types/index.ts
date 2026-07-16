export type UserRole = "attendee" | "speaker" | "facilitator";
export type ChatChannel = "support" | "live_qa";

export interface User {
  user_id: number;
  full_name: string;
  email: string;
  clerk_id: string;
  role: UserRole;
  profile_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export type ContentType = "pdf" | "video" | "image" | "link";

export interface Course {
  course_id: number;
  course_name: string;
  course_description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Module {
  module_id: number;
  course_id: number;
  module_name: string;
  sequence_order: number;
  created_at: string;
  updated_at: string;
}

export interface Lesson {
  lesson_id: number;
  module_id: number;
  description: string;
  content_type: ContentType;
  content_url: string;
  total_units: number;
  sequence_order: number;
  created_at: string;
  updated_at: string;
}

export interface LessonProgress {
  lesson_id: number;
  user_id: number;
  units_completed: number;
  is_completed: boolean;
  updated_at: string;
}

export type EventStatus = "draft" | "active" | "complete";

export interface Event {
  event_id: number;
  course_id: number | null;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue_address: string | null;
  venue_name: string;
  description: string | null;
  overview: string | null;
  lat: number | null;
  lng: number | null;
  price: number;
  currency: string;
  cover_image_url: string | null;
  status: EventStatus;
  created_at: string;
  updated_at: string;
}

export interface SpeakerProfile {
  speaker_profile_id: number;
  user_id: number;
  bio: string | null;
  photo_url: string | null;
  designation: string | null;
  created_at: string;
  updated_at: string;
}

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type TicketStatus = "issued" | "checked_in" | "cancelled";

export interface Payment {
  payment_id: number;
  user_id: number;
  event_id: number;
  hitpay_reference_id: string | null;
  status: PaymentStatus;
  paid_at: string | null;
  amount: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface LiveSessionState {
  event_id: number;
  current_lesson_id: number | null;
  updated_by: number;
  updated_at: string;
}

export interface Ticket {
  payment_id: number;
  user_id: number;
  event_id: number;
  qr_token: string;
  status: TicketStatus;
  issued_at: string;
  checked_in_by: number | null;
  updated_at: string;
}

export interface ChatMessage {
  message_id: number;
  event_id: number;
  channel: ChatChannel;
  user_id: number;
  message: string;
  sent_at: string;
  read_by: number[];
  deleted_at: string | null;
  updated_at: string;
}

export type EmailType = "registration_confirmation" | "ticket_issued" | "check_in_confirmed";
export type EmailStatus = "sent" | "failed";

export interface EmailLog {
  log_id: number;
  user_id: number;
  email_type: EmailType;
  status: EmailStatus;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}
