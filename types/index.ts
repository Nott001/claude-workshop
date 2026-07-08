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
