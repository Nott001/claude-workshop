import Link from "next/link";
import { cn } from "@/shared/lib/utils";

interface BackLinkProps {
  href: string;
  /** The label. Phrased as the destination — "Back to Events", not "Back". */
  children: React.ReactNode;
  className?: string;
}

/**
 * The way back out of a page someone drilled into.
 *
 * A link, never a button wired to `router.push`. It navigates, so it has to
 * carry an href: that is what lets it be middle-clicked, opened in a new tab,
 * previewed in the status bar, and announced as a link rather than as a
 * control that does something unknowable.
 *
 * The glyph is hidden from assistive tech because a Material Symbols ligature
 * is literally the text "arrow_back", which a screen reader reads out ahead of
 * the label unless told not to.
 */
export function BackLink({ href, children, className }: BackLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex w-fit items-center gap-1.5 text-sm font-medium text-muted-fg transition-colors hover:text-fg",
        className,
      )}
    >
      <span aria-hidden className="material-symbols-rounded text-[16px]">
        arrow_back
      </span>
      {children}
    </Link>
  );
}
