export type UserRole = "attendee" | "speaker" | "facilitator";

export interface User {
  user_id: number;
  full_name: string;
  email: string;
  clerk_id: string;
  role: UserRole;
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
