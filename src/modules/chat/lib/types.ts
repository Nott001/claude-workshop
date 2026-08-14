import type { ChatMessage, UserRole } from "@/shared/types";

export interface ChatMessageWithUser extends ChatMessage {
  USER: { full_name: string; role: UserRole };
}
