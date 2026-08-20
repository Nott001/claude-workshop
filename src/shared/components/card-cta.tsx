import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

/**
 * The "go here" line: a label and a chevron, in the brand colour.
 *
 * It had been written out four times — on the event card, the memory card, the
 * gallery strip and the memories header — and the copies had already begun to
 * differ, one of them omitting `aria-hidden` on the icon, which reads the
 * ligature "chevron_right" out loud to a screen reader.
 *
 * Deliberately not a link. Two of the four sit inside a `Link` that wraps the
 * whole card, where a nested anchor would be invalid markup and would give the
 * card two tab stops; the other two are the label of a real link. So this
 * renders the label and lets the caller decide what, if anything, is clickable.
 */
export function CardCta({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm font-semibold text-brand", className)}>
      {children}
      <span aria-hidden className="material-symbols-rounded text-base!">
        chevron_right
      </span>
    </span>
  );
}
