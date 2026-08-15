/**
 * Lifecycle notices the staff actions write into a case, so the attendee sees
 * them in the thread. The panel recognises them by their bracket prefix and
 * renders a neutral divider rather than a chat bubble.
 */
export const CHAT_CLAIMED_MESSAGE = "[Case assigned] A support staff member has picked up your case.";
export const CHAT_UNCLAIMED_MESSAGE = "[Case unassigned] Your case is waiting for the next available support staff member.";
export const CHAT_ENDED_MESSAGE = "[Chat ended] Support ended this chat. Send a new message to open a new case.";

export type SupportNoticeKind = "assigned" | "unassigned" | "ended";

const NOTICE_KINDS: Array<[SupportNoticeKind, string]> = [
  ["ended", "[Chat ended"],
  ["assigned", "[Case assigned"],
  ["unassigned", "[Case unassigned"],
];

export function supportNoticeKind(message: string): SupportNoticeKind | null {
  for (const [kind, prefix] of NOTICE_KINDS) {
    if (message.startsWith(prefix)) return kind;
  }
  return null;
}
