import { checkInConfirmedTemplate } from "./check-in-confirmed";
import { eventSurveyTemplate } from "./event-survey";
import { ticketIssuedTemplate } from "./ticket-issued";

export { memberInvitedTemplate } from "./member-invited";
export { passwordResetTemplate } from "./password-reset";
export type { CheckInConfirmedParams } from "./check-in-confirmed";
export type { EventSurveyParams } from "./event-survey";
export type { MemberInvitedParams } from "./member-invited";
export type { PasswordResetParams } from "./password-reset";
export type { TicketIssuedParams } from "./ticket-issued";

/**
 * The templates whose messages get an EMAIL_LOG row, keyed by the email_type
 * enum value that produces them. `memberInvitedTemplate` and
 * `passwordResetTemplate` stay out of here: neither recipient is guaranteed a
 * USER row for that table to reference — an invitee has no account yet, and a
 * reset can be requested for an address that owns none. The audit log records
 * the invitation and the completed reset instead.
 */
export const emailTemplates = {
  ticketIssued: ticketIssuedTemplate,
  checkInConfirmed: checkInConfirmedTemplate,
  eventSurvey: eventSurveyTemplate,
} as const;
