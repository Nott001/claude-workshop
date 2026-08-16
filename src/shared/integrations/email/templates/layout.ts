/**
 * Values interpolated into the HTML half of a message are user-controlled — a
 * member's name, an event title someone else typed — and the message reaches
 * inboxes other than the author's. Unescaped, a title carrying markup renders
 * as markup inside mail that otherwise passes SPF and DKIM, which is the part
 * that makes it worth injecting into.
 *
 * Escaping happens per value at the interpolation site rather than as a pass
 * over the finished document, so the markup the templates own stays intact.
 * `&` goes first; reversing that order would double-escape the entities the
 * later replacements introduce.
 *
 * The text halves are deliberately left alone: nothing parses them as markup,
 * and an `&amp;` in a text/plain body reaches the reader literally.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

import { BRAND, BRAND_FULL, MAIL_DOMAIN } from "../brand";

// Re-exported so a template imports its brand from the same module it imports
// `layout` and `escapeHtml` from.
export { BRAND, BRAND_FULL, MAIL_DOMAIN };

/**
 * Why the message arrived, for a recipient who did register for something.
 *
 * The default rather than the only option: an invitation reaches somebody who
 * has never registered for anything, and a password reset is answering a
 * request, so both would be telling the reader something untrue. Each template
 * owns one of these and hands the same sentence to both of its halves, which is
 * what stops the HTML and the text disagreeing about why the mail was sent.
 */
export const REGISTERED_FOR_EVENT = `You received this because you registered for an event at ${BRAND}.`;

/**
 * The text half's closing block, matching what `layout` prints in the HTML.
 *
 * Every template had been repeating these three lines, which is how the two
 * halves come to disagree — and how the brand drifted in the first place.
 */
export function textFooter(reason: string = REGISTERED_FOR_EVENT): string[] {
  return ["--", `${BRAND_FULL} · ${MAIL_DOMAIN}`, `${reason} This mailbox is unattended.`];
}

/**
 * A bare fragment of `<h1>`/`<p>` scores worse with spam filters than a
 * complete document, so every message is wrapped in one: doctype, charset,
 * a title, and a footer saying who sent it and why it arrived.
 */
export function layout(title: string, body: string, reason: string = REGISTERED_FOR_EVENT): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2933">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px">
${body}
    </div>
    <div style="max-width:560px;margin:16px auto 0;font-size:12px;line-height:1.6;color:#6b7280;text-align:center">
      <p style="margin:0">${BRAND_FULL} &middot; ${MAIL_DOMAIN}</p>
      <p style="margin:4px 0 0">${escapeHtml(reason)} This mailbox is unattended.</p>
    </div>
  </body>
</html>`;
}
