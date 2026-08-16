/**
 * What this sender calls itself, in one place.
 *
 * Its own module rather than living with the templates, because the SMTP
 * provider needs the display name too and a provider reaching into the
 * templates directory would be the wrong way round.
 *
 * The mail had drifted to "Startup Lab" while every other surface of the
 * product says "StartupLab" — a brand a recipient cannot match to the domain it
 * arrives from is one of the cheaper signals a filter has, and there is nothing
 * to gain by being inconsistent about it.
 */

/** The wordmark. Used as the sender's display name and mid-sentence. */
export const BRAND = "StartupLab";

/** The full name, for the footer line that identifies who sent the message. */
export const BRAND_FULL = "StartupLab Business Center";

/** The domain the mail is sent from and signed by. */
export const MAIL_DOMAIN = "startuplab.center";
