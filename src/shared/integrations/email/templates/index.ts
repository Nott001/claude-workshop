import { checkInConfirmedTemplate } from "./check-in-confirmed";
import { eventSurveyTemplate } from "./event-survey";
import { ticketIssuedTemplate } from "./ticket-issued";

export { memberInvitedTemplate } from "./member-invited";
export type { CheckInConfirmedParams } from "./check-in-confirmed";
export type { EventSurveyParams } from "./event-survey";
export type { MemberInvitedParams } from "./member-invited";
export type { TicketIssuedParams } from "./ticket-issued";

/**
 * The templates whose messages get an EMAIL_LOG row, keyed by the email_type
 * enum value that produces them. `memberInvitedTemplate` stays out of here:
 * an invitee has no USER row for that table to reference, and the audit log
 * already records the invitation.
 */
export const emailTemplates = {
  ticketIssued: ticketIssuedTemplate,
  checkInConfirmed: checkInConfirmedTemplate,
  eventSurvey: eventSurveyTemplate,
} as const;
