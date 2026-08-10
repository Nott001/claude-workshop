export interface EventSpeakerProfile {
  id: number;
  user_id: number;
  bio: string | null;
  designation: string | null;
  photo_url: string | null;
  USER: { full_name: string; email: string } | null;
}

export interface EventSpeakerEntry {
  SPEAKER_PROFILE: EventSpeakerProfile;
}

export interface EventWithCourse {
  id: number;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  venue_address: string | null;
  course_id: number | null;
  cover_image_url: string | null;
  status: "draft" | "active" | "complete";
  price: number;
  currency: string;
  description: string | null;
  survey_enabled: boolean;
  COURSE: { id: number; course_name: string; course_description: string | null } | null;
  EVENT_SPEAKER: EventSpeakerEntry[];
  EVENT_FACILITATOR?: { user_id: number }[];
  attendee_count?: number;
  payment_count?: number;
}
