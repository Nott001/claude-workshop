import { BackLink } from "@/shared/components/back-link";
import { resolveBackLink, type BackLinkOrigin } from "@/shared/lib/back-link";

/**
 * The way out of an auth screen for someone who did not mean to be on one.
 *
 * The page they came from, named by the `?from=` the link into this screen
 * carried, and the landing page when it carried none — a bookmark or a typed
 * address has no origin to return to. Not history: these screens are also
 * reached by a guard redirecting mid-navigation, and stepping back one entry
 * returns the user to the page that bounced them, which bounces them here
 * again.
 *
 * The default is spelled out rather than left to `resolveBackLink`, whose own
 * fallback is the events list — right for an event page, wrong for this one.
 */
export function AuthBackLink({ origin, className }: { origin?: BackLinkOrigin; className?: string }) {
  const back = resolveBackLink(origin ?? "landing");

  return (
    <BackLink href={back.href} className={className}>
      {back.label}
    </BackLink>
  );
}
