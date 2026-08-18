import { ROLES } from "@/shared/lib/roles";
import { isChatStaff } from "@/shared/lib/is-chat-staff";
import type { UserRole } from "@/shared/types";

export type QaAuthorKind = "speaker" | "staff" | "attendee";

/**
 * How a Q&A message bubble should read, from its author's role. A speaker is
 * not staff: `isChatStaff` is facilitator-or-higher and Q&A answers come from
 * both. The three-way split lets the panel highlight answers but keep attendee
 * questions visually neutral.
 */
export function qaAuthorKind(role: UserRole | null | undefined): QaAuthorKind | null {
  if (!role) return null;
  if (role === ROLES.SPEAKER) return "speaker";
  if (isChatStaff(role)) return "staff";
  return "attendee";
}
