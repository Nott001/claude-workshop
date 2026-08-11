export interface EventSpeakerProfile {
  id: number;
  user_id: number;
  bio: string | null;
  designation: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  github_url: string | null;
  website_url: string | null;
  USER: { full_name: string; email: string; profile_image_url: string | null } | null;
}

export interface EventSpeakerEntry {
  SPEAKER_PROFILE: EventSpeakerProfile;
}

export interface EventScheduleItem {
  id: number;
  module_name: string;
  start_time: string | null;
  end_time: string | null;
  /** Speaker full name, or null when the module has no assigned speaker. */
  speaker: string | null;
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
