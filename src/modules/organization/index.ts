import type { UserRole } from "@/types";

export interface StaffMember {
  user_id: number;
  full_name: string;
  email: string;
  role: UserRole;
}
