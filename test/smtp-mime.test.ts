import { describe, it, expect } from "vitest";
import { buildMimeMessage, hoistInlineImages, htmlToText } from "@/shared/integrations/email/providers/smtp/mime";

const FROM = { email: "no-reply@startuplab.center", name: "Startup Lab" };
const TO = { email: "attendee@example.com", name: "Ada" };
const NOW = new Date("2026-08-04T08:30:00Z");

function build(html: string, overrides: Partial<Parameters<typeof buildMimeMessage>[0]> = {}): string {
  return buildMimeMessage({ from: FROM, to: TO, subject: "Subject", html, now: NOW, idSeed: "seed1", ...overrides });
}

/** Reverses the transfer encoding so assertions read the delivered content. */
function decodePart(message: string, contentType: string): string {
  const part = message.split(/--[a-z]+\.seed1/).find((chunk) => chunk.includes(`Content-Type: ${contentType}`));
  if (!part) throw new Error(`no ${contentType} part in message`);
  const body = part.split("\r\n\r\n").slice(1).join("\r\n\r\n").trim();
  return new TextDecoder().decode(Uint8Array.from(atob(body.replace(/\r\n/g, "")), (c) => c.charCodeAt(0)));
}

describe("htmlToText", () => {
  it("keeps readable prose and drops markup", () => {
    const text = htmlToText("<h1>Ticket</h1><p>Hi <strong>Ada</strong>,</p><p>See you &mdash; soon.</p>");
    expect(text).toContain("Ticket");
    expect(text).toContain("Hi Ada,");
    expect(text).toContain("See you — soon.");
    expect(text).not.toContain("<");
  });

  it("substitutes an image for its alt text", () => {
    expect(htmlToText('<p><img src="data:image/png;base64,AAA" alt="QR code" /></p>')).toBe("QR code");
  });

  it("drops an image that has no alt text", () => {
    expect(htmlToText('<p>Before<img src="data:image/png;base64,AAA" />After</p>')).toBe("BeforeAfter");
  });

  it("does not leak script or style bodies", () => {
    expect(htmlToText("<style>p{color:red}</style><script>alert(1)</script><p>Body</p>")).toBe("Body");
  });
});

describe("hoistInlineImages", () => {
  it("rewrites a data URI to a cid reference and captures the payload", () => {
    const { html, images } = hoistInlineImages('<img src="data:image/png;base64,QUJD" />', "seed1");

    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({ mediaType: "image/png", base64: "QUJD" });
    expect(html).toContain(`src="cid:${images[0].cid}"`);
    expect(html).not.toContain("data:image");
  });

  it("handles single-quoted attributes and multiple images", () => {
    const { html, images } = hoistInlineImages(
      `<img src='data:image/gif;base64,R0lG' /><img src="data:image/png;base64,QUJD" />`,
      "seed1",
    );

    expect(images.map((image) => image.mediaType)).toEqual(["image/gif", "image/png"]);
    expect(new Set(images.map((image) => image.cid)).size).toBe(2);
    expect(html).not.toContain("data:image");
  });

  it("leaves remote images alone", () => {
    const html = '<img src="https://cdn.example.com/logo.png" />';
    expect(hoistInlineImages(html, "seed1")).toEqual({ html, images: [] });
  });
});

describe("buildMimeMessage", () => {
  it("emits the headers a receiving MTA requires", () => {
    const message = build("<p>Hello</p>");

    expect(message).toContain('From: "Startup Lab" <no-reply@startuplab.center>');
    expect(message).toContain('To: "Ada" <attendee@example.com>');
    expect(message).toContain("Subject: Subject");
    expect(message).toContain("Date: Tue, 04 Aug 2026 08:30:00 +0000");
    expect(message).toContain("Message-ID: <seed1@startuplab.center>");
    expect(message).toContain("MIME-Version: 1.0");
  });

  it("separates headers from the body with a blank line", () => {
    expect(build("<p>Hello</p>")).toMatch(/MIME-Version: 1\.0\r\n[^\r]*\r\n\r\n/);
  });

  it("carries a plain-text alternative alongside the HTML", () => {
    const message = build("<p>Hi Ada</p>");

    expect(message).toContain("multipart/alternative");
    expect(decodePart(message, 'text/plain; charset="UTF-8"')).toBe("Hi Ada");
    expect(decodePart(message, 'text/html; charset="UTF-8"')).toBe("<p>Hi Ada</p>");
  });

  it("wraps inline images in multipart/related with a matching Content-ID", () => {
    const message = build('<p>Ticket</p><img src="data:image/png;base64,QUJD" alt="QR" />');

    expect(message).toContain('Content-Type: multipart/related; type="multipart/alternative"');
    expect(message).toContain("Content-Type: image/png");
    expect(message).toContain("Content-Disposition: inline");

    const cid = message.match(/Content-ID: <([^>]+)>/)?.[1];
    expect(cid).toBeTruthy();
    expect(decodePart(message, 'text/html; charset="UTF-8"')).toContain(`src="cid:${cid}"`);
  });

  it("carries the image bytes in the related part, not just its headers", () => {
    // An empty part still parses and still shows the right Content-ID, so the
    // structural assertions above pass while the recipient sees a broken image.
    const payload = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const message = build(`<p><img src="data:image/png;base64,${payload}" alt="QR" /></p>`);

    const imageSection = message.slice(message.indexOf("Content-ID:"));
    const body = imageSection.split("\r\n\r\n")[1]?.split("\r\n--")[0] ?? "";

    expect(body.replace(/\r\n/g, "")).toBe(payload);
  });

  it("stays multipart/alternative when nothing is inlined", () => {
    const message = build("<p>Plain</p>");
    expect(message).toContain("Content-Type: multipart/alternative");
    expect(message).not.toContain("multipart/related");
  });

  it("encodes a non-ASCII subject as an RFC 2047 word", () => {
    const message = build("<p>x</p>", { subject: "Registration Confirmed — Ready" });

    expect(message).toContain("Subject: =?UTF-8?B?");
    expect(message).not.toContain("Subject: Registration Confirmed — Ready");
  });

  it("escapes a display name that contains a quote", () => {
    const message = build("<p>x</p>", { to: { email: "q@example.com", name: 'A "Q" B' } });
    expect(message).toContain('To: "A \\"Q\\" B" <q@example.com>');
  });

  it("omits the angle-bracket name form when there is no name", () => {
    expect(build("<p>x</p>", { to: { email: "bare@example.com" } })).toContain("To: <bare@example.com>");
  });

  it("folds base64 bodies to the 76-character limit", () => {
    const message = build(`<p>${"long content ".repeat(40)}</p>`);
    const overlong = message.split("\r\n").filter((line) => line.length > 76);
    expect(overlong).toEqual([]);
  });

  it("gives each message a distinct Message-ID by default", () => {
    const first = buildMimeMessage({ from: FROM, to: TO, subject: "s", html: "<p>a</p>" });
    const second = buildMimeMessage({ from: FROM, to: TO, subject: "s", html: "<p>a</p>" });
    expect(first.match(/Message-ID: <(.+)>/)?.[1]).not.toBe(second.match(/Message-ID: <(.+)>/)?.[1]);
  });
});
