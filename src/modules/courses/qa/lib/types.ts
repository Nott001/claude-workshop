import type { QaMessage, UserRole } from "@/shared/types";

export interface QaMessageWithUser extends QaMessage {
  USER: { full_name: string; role: UserRole };
}
