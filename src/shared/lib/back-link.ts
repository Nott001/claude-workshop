/**
 * Where a detail page was opened from, so its back link returns the reader to
 * that page instead of guessing a list they may never have visited.
 *
 * The origin travels as a key, not as a path: a key can only ever resolve to a
 * route this app owns, so no hand-edited query string can turn a back link into
 * an off-site redirect — and the key is also what carries the label, which a
 * bare path cannot supply.
 */

export const BACK_LINK_PARAM = "from";

/** Search params of a route that accepts a relayed origin. Derived from the
 *  constant so renaming the parameter breaks the routes rather than silently
 *  leaving them reading a key nothing writes. */
export type BackLinkSearchParams = Partial<Record<typeof BACK_LINK_PARAM, string>>;

const BACK_LINKS = {
  events: { href: "/events", label: "Back to Events" },
  community: { href: "/community", label: "Back to Community" },
  home: { href: "/home", label: "Back to Home" },
  landing: { href: "/", label: "Back to Home" },
  tickets: { href: "/tickets", label: "Back to My Tickets" },
} as const;

export type BackLinkOrigin = keyof typeof BACK_LINKS;

export interface BackLink {
  href: string;
  label: string;
}

/**
 * Narrows a raw `?from=` value to an origin, or `undefined` when it names none.
 * The value is user-editable, so nothing here may trust it.
 */
export function toBackLinkOrigin(value: string | string[] | undefined): BackLinkOrigin | undefined {
  // `hasOwn`, not `in`: `in` walks the prototype chain, so `?from=toString`
  // would "match" and hand back a function instead of a link.
  return typeof value === "string" && Object.hasOwn(BACK_LINKS, value) ? (value as BackLinkOrigin) : undefined;
}

/**
 * Tags `href` so the page it opens knows where to send the reader back to.
 * An absent origin leaves the href alone, which lets a page that is merely
 * relaying one it was given pass it straight through untouched.
 */
export function withBackLink(href: string, origin: BackLinkOrigin | undefined): string {
  if (!origin) return href;
  return `${href}${href.includes("?") ? "&" : "?"}${BACK_LINK_PARAM}=${origin}`;
}

/**
 * Resolves a `?from=` value to the link to render. Anything missing, repeated
 * or unrecognised falls back to the events list rather than throwing — the
 * parameter is user-editable, and a shared or bookmarked link routinely
 * arrives without it.
 */
export function resolveBackLink(value: string | string[] | undefined): BackLink {
  return BACK_LINKS[toBackLinkOrigin(value) ?? "events"];
}

/** Longest prefix first, so `/events/5` is not claimed by a shorter entry. */
const ORIGIN_BY_PREFIX: ReadonlyArray<readonly [string, BackLinkOrigin]> = [
  ["/events", "events"],
  ["/community", "community"],
  ["/tickets", "tickets"],
  ["/home", "home"],
];

/**
 * The origin a link *leaving* the current page should carry, so the page it
 * opens can offer the way back.
 *
 * Named from the route the reader is on rather than from browser history: a
 * page reached by a guard's redirect has history pointing at the page that
 * bounced them, and sending them back there only bounces them again.
 */
export function originFromPathname(pathname: string): BackLinkOrigin | undefined {
  if (pathname === "/") return "landing";
  return ORIGIN_BY_PREFIX.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1];
}
