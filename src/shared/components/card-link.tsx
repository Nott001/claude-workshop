import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

/**
 * A card that is entirely a link: the surface, the lift it answers a hover
 * with, and the prefetch policy.
 *
 * The event grid and the memories strip had written this out twice and the
 * copies had converged to within a single class, which is worse than either
 * sharing it or genuinely differing — the two sit in grids of the same shape on
 * pages a reader moves between, so a card that answers the same gesture
 * differently reads as a different kind of thing. Keeping them in step was
 * costing a test that read one component's class list out of the other's source
 * file; that test is gone with this.
 *
 * The shell only. What goes inside is the caller's: the event card leads with a
 * cover and a status badge, the memory card with a mosaic of photographs, and
 * their titles and metadata are nothing alike. A component with a slot for each
 * of those differences would be harder to read than either card is.
 */
export function CardLink({
  href,
  className,
  style,
  children,
}: {
  href: string;
  className?: string;
  /** Only for values that cannot be a class, such as a per-card animation delay. */
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      style={style}
      // One card is one prefetch, and a grid scrolls several into view at once
      // — each a full render of a detail page nobody has opened. This was the
      // largest single source of speculative load in the app.
      prefetch={false}
      // `block` is the default rather than the rule: `cn` is tailwind-merge, so
      // a caller needing a flex column passes one and it replaces this cleanly
      // instead of both landing on the element.
      //
      // The lift is `motion-safe:`, the shadow is not. Movement is what a
      // reader who has asked their system for reduced motion is asking to be
      // spared — a vestibular trigger, not a taste — while a shadow deepening
      // in place still answers the hover and moves nothing.
      className={cn(
        "group block overflow-hidden rounded-xl border border-border bg-surface shadow-[0_4px_20px_rgba(0,0,0,.05)] transition-all duration-300 ease-in-out motion-safe:hover:scale-[1.02] hover:shadow-[0_8px_30px_rgba(0,0,0,.12)]",
        className,
      )}
    >
      {children}
    </Link>
  );
}
