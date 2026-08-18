import { isEventStarted } from "@/shared/lib/date-utils";

/**
 * Who may see an online event's meeting link, and when.
 *
 * Kept free of any database import so the join card can use the same rules the
 * API enforces with them — a client that decided for itself when to reveal a
 * link would be a second, quietly diverging copy of the policy.
 */

/** The shape both rules read. Everything here already reaches the browser. */
export interface MeetingLinkEvent {
  event_type?: string | null;
  event_date: string;
  start_time: string;
  meeting_url?: string | null;
}

export interface MeetingLinkViewer {
  /** Facilitator and up. Staff hold the link because staff have to set it. */
  isStaff: boolean;
  hasTicket: boolean;
}

/**
 * A meeting link is an unauthenticated door: anyone holding it walks in, which
 * makes capacity and payment decorative. So it is served to staff, and to a
 * ticket holder only once the event has started — the same edge the register
 * card unlocks "Enter Room" on, so an attendee meets one rule rather than two.
 */
export function canSeeMeetingLink(event: MeetingLinkEvent, viewer: MeetingLinkViewer): boolean {
  if (viewer.isStaff) return true;
  return viewer.hasTicket && isEventStarted(event.event_date, event.start_time);
}

/**
 * Strip the link unless the viewer may hold it. Returns the event unchanged
 * when they may, and with `meeting_url` nulled when they may not — never the
 * key deleted, so a caller cannot tell "withheld" from "never set" by shape.
 */
export function redactMeetingUrl<T extends { meeting_url?: string | null }>(event: T, visible: boolean): T {
  if (visible || event.meeting_url == null) return event;
  return { ...event, meeting_url: null };
}

/**
 * What the join card should render, from what the viewer was actually served.
 *
 * `pending` and `none` are deliberately indistinguishable to someone without
 * the link: both mean "you have no link", and telling them apart would leak
 * whether one exists yet.
 */
export type MeetingLinkState = "ready" | "pending" | "none";

export function meetingLinkState(event: MeetingLinkEvent): MeetingLinkState {
  if (event.meeting_url) return "ready";
  return isEventStarted(event.event_date, event.start_time) ? "none" : "pending";
}
