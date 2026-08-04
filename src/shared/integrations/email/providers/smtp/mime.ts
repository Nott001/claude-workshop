import { foldBase64, utf8ToBase64 } from "./encoding";

const CRLF = "\r\n";

export interface MimeAddress {
  email: string;
  name?: string;
}

export interface MimeMessageParams {
  from: MimeAddress;
  to: MimeAddress;
  subject: string;
  html: string;
  /** Injected by tests so the output is deterministic. */
  now?: Date;
  idSeed?: string;
}

interface InlineImage {
  cid: string;
  mediaType: string;
  base64: string;
}

/** `src="data:image/png;base64,…"`, either quoting style. */
const DATA_URI_SRC = /src=(["'])data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)\1/gi;

function isAscii(value: string): boolean {
  return /^[\x20-\x7E]*$/.test(value);
}

/** Header values are ASCII-only; anything else needs RFC 2047 encoded-word form. */
function encodeHeader(value: string): string {
  return isAscii(value) ? value : `=?UTF-8?B?${utf8ToBase64(value)}?=`;
}

function formatAddress({ email, name }: MimeAddress): string {
  if (!name) return `<${email}>`;
  if (!isAscii(name)) return `${encodeHeader(name)} <${email}>`;
  return `"${name.replace(/(["\\])/g, "\\$1")}" <${email}>`;
}

/** RFC 5322 wants a numeric offset, but toUTCString() ends in `GMT`. */
function formatDate(date: Date): string {
  return date.toUTCString().replace(/GMT$/, "+0000");
}

/**
 * Spam filters score HTML-only mail worse and some clients render nothing at
 * all, so every message carries a plain-text alternative derived from the HTML.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<img[^>]*\balt="([^"]*)"[^>]*>/gi, "$1")
    .replace(/<img[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Moves `data:` images into MIME parts and rewrites the tags to `cid:` refs.
 * Gmail, Outlook desktop and Outlook.com all strip `data:` URIs from `img src`,
 * so a QR code left inline reaches most attendees as an empty box.
 */
export function hoistInlineImages(html: string, idSeed: string): { html: string; images: InlineImage[] } {
  const images: InlineImage[] = [];

  const rewritten = html.replace(DATA_URI_SRC, (_match, quote: string, mediaType: string, payload: string) => {
    const cid = `img-${images.length}.${idSeed}`;
    images.push({ cid, mediaType: mediaType.toLowerCase(), base64: payload.replace(/\s+/g, "") });
    return `src=${quote}cid:${cid}${quote}`;
  });

  return { html: rewritten, images };
}

function alternativePart(boundary: string, html: string): string[] {
  return [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    foldBase64(utf8ToBase64(htmlToText(html))),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    foldBase64(utf8ToBase64(html)),
    `--${boundary}--`,
  ];
}

function imagePart(boundary: string, image: InlineImage): string[] {
  return [
    `--${boundary}`,
    `Content-Type: ${image.mediaType}`,
    "Content-Transfer-Encoding: base64",
    `Content-ID: <${image.cid}>`,
    "Content-Disposition: inline",
    "",
    // Already base64 in the data URI — decoding to re-encode would be wasted work.
    foldBase64(image.base64),
  ];
}

export function buildMimeMessage(params: MimeMessageParams): string {
  const now = params.now ?? new Date();
  const idSeed = params.idSeed ?? crypto.randomUUID().replace(/-/g, "");
  const domain = params.from.email.split("@")[1] ?? "localhost";

  const { html, images } = hoistInlineImages(params.html, idSeed);
  const altBoundary = `alt.${idSeed}`;

  const headers = [
    `From: ${formatAddress(params.from)}`,
    `To: ${formatAddress(params.to)}`,
    `Subject: ${encodeHeader(params.subject)}`,
    `Date: ${formatDate(now)}`,
    `Message-ID: <${idSeed}@${domain}>`,
    "MIME-Version: 1.0",
  ];

  if (images.length === 0) {
    headers.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
    return [...headers, "", ...alternativePart(altBoundary, html), ""].join(CRLF);
  }

  // multipart/related wraps the alternative so clients treat the images as part
  // of the body rather than as downloadable attachments.
  const relBoundary = `rel.${idSeed}`;
  headers.push(`Content-Type: multipart/related; type="multipart/alternative"; boundary="${relBoundary}"`);

  const body = [
    `--${relBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    ...alternativePart(altBoundary, html),
    ...images.flatMap((image) => imagePart(relBoundary, image)),
    `--${relBoundary}--`,
  ];

  return [...headers, "", ...body, ""].join(CRLF);
}
