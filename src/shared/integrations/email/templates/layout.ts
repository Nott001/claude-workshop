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

/**
 * A bare fragment of `<h1>`/`<p>` scores worse with spam filters than a
 * complete document, so every message is wrapped in one: doctype, charset,
 * a title, and a footer saying who sent it and why it arrived.
 */
export function layout(title: string, body: string): string {
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
      <p style="margin:0">Startup Lab &middot; startuplab.center</p>
      <p style="margin:4px 0 0">
        You received this because you registered for an event at Startup Lab.
        This mailbox is unattended.
      </p>
    </div>
  </body>
</html>`;
}
