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
  /** Written by the caller; derived from the HTML when omitted. */
  text?: string;
  replyTo?: string;
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

const ENTITIES: Record<string, string> = {
  "&mdash;": "\u2014",
  // The footer in `layout` separates the two halves of its byline with one.
  "&middot;": "\u00b7",
  "&nbsp;": " ",
  "&quot;": '"',
  "&#39;": "'",
  "&lt;": "<",
  "&gt;": ">",
  "&amp;": "&",
};

/** Elements whose content is styling or code, never prose. */
const OPAQUE_ELEMENTS = new Set(["script", "style"]);

/** Elements whose close ends a run of prose, so the text wants a blank line. */
const BLOCK_ELEMENTS = new Set(["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "tr"]);

/**
 * One pass, so `&amp;lt;` yields the literal `&lt;` an author typed rather
 * than being decoded a second time into `<`.
 */
function decodeEntities(text: string): string {
  return text.replace(/&(?:mdash|middot|nbsp|quot|#39|lt|gt|amp);/g, (entity) => ENTITIES[entity] ?? entity);
}

/**
 * `>` inside an attribute value does not close the tag, so quoted runs are
 * skipped rather than scanned for the delimiter.
 */
function findTagEnd(html: string, start: number): number {
  let quote: string | null = null;

  for (let i = start + 1; i < html.length; i++) {
    const char = html[i];

    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === ">") {
      return i;
    }
  }

  return -1;
}

/**
 * Spam filters score HTML-only mail worse and some clients render nothing at
 * all, so every message carries a plain-text alternative derived from the HTML.
 *
 * Written as a single left-to-right scan rather than a set of `replace` calls
 * applied until the string stops changing. Stripping a substring can leave its
 * neighbours adjacent and spell out a new tag \u2014 `<scr<script>ipt>` survives one
 * removal pass \u2014 and looping until stable answers that only for the cases the
 * expressions already match. Emitted text is never re-examined here, so a `<`
 * in the prose cannot pair with a later one to form a tag that was not in the
 * input to begin with.
 */
export function htmlToText(html: string): string {
  const out: string[] = [];
  let cursor = 0;

  while (cursor < html.length) {
    const open = html.indexOf("<", cursor);

    if (open === -1) {
      out.push(decodeEntities(html.slice(cursor)));
      break;
    }

    out.push(decodeEntities(html.slice(cursor, open)));

    // A comment ends at `-->`, not at the first `>`, which may sit inside it.
    if (html.startsWith("<!--", open)) {
      const end = html.indexOf("-->", open + 4);
      cursor = end === -1 ? html.length : end + 3;
      continue;
    }

    const close = findTagEnd(html, open);
    if (close === -1) {
      // A `<` with no `>` after it is prose the author wrote, not a tag.
      out.push(decodeEntities(html.slice(open)));
      break;
    }

    const tag = html.slice(open + 1, close);
    const name = /^\/?\s*([a-zA-Z][a-zA-Z0-9]*)/.exec(tag)?.[1]?.toLowerCase();
    const isClosing = tag.startsWith("/");
    cursor = close + 1;

    // The doctype and processing instructions carry nothing to read.
    if (tag.startsWith("!") || tag.startsWith("?")) continue;

    // `<` before anything but a letter opens no element — `5 < 7` is arithmetic
    // the author wrote, and a browser reads it that way too. Dropping to the
    // next `>` would eat the words in between.
    if (!name) {
      out.push(decodeEntities(html.slice(open, cursor)));
      continue;
    }

    if (!isClosing && OPAQUE_ELEMENTS.has(name)) {
      const end = new RegExp(`</\\s*${name}\\s*>`, "i").exec(html.slice(cursor));
      // An unterminated script or style swallows the rest of the document,
      // which is the safe reading: none of it was meant to be read.
      cursor = end ? cursor + end.index + end[0].length : html.length;
      continue;
    }

    if (name === "img" && !isClosing) {
      const alt = /\balt\s*=\s*"([^"]*)"/i.exec(tag)?.[1] ?? /\balt\s*=\s*'([^']*)'/i.exec(tag)?.[1];
      if (alt) out.push(decodeEntities(alt));
      continue;
    }

    if (name === "br") {
      out.push("\n");
    } else if (isClosing && BLOCK_ELEMENTS.has(name)) {
      out.push("\n\n");
    }
  }

  return out
    .join("")
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

function alternativePart(boundary: string, html: string, text: string): string[] {
  return [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    foldBase64(utf8ToBase64(text)),
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
  const text = params.text ?? htmlToText(params.html);

  const headers = [
    `From: ${formatAddress(params.from)}`,
    `To: ${formatAddress(params.to)}`,
    `Subject: ${encodeHeader(params.subject)}`,
    `Date: ${formatDate(now)}`,
    `Message-ID: <${idSeed}@${domain}>`,
    "MIME-Version: 1.0",
    // Marks the message as machine-generated transactional mail rather than
    // bulk, which is how filters are meant to tell the two apart.
    "Auto-Submitted: auto-generated",
  ];

  if (params.replyTo) headers.push(`Reply-To: <${params.replyTo}>`);

  if (images.length === 0) {
    headers.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
    return [...headers, "", ...alternativePart(altBoundary, html, text), ""].join(CRLF);
  }

  // multipart/related wraps the alternative so clients treat the images as part
  // of the body rather than as downloadable attachments.
  const relBoundary = `rel.${idSeed}`;
  headers.push(`Content-Type: multipart/related; type="multipart/alternative"; boundary="${relBoundary}"`);

  const body = [
    `--${relBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    ...alternativePart(altBoundary, html, text),
    ...images.flatMap((image) => imagePart(relBoundary, image)),
    `--${relBoundary}--`,
  ];

  return [...headers, "", ...body, ""].join(CRLF);
}
