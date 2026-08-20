import { cn } from "@/shared/lib/utils";

/**
 * One placeholder shape, and the only place the placeholder's fill and pulse
 * are decided.
 *
 * A skeleton is not decoration and not a politer spinner. The app shell renders
 * its footer with `mt-auto`, so a page whose loading state is one line of
 * centred text parks that footer inside the viewport, and the arriving content
 * then shoves it down — measured at 0.426 on the event detail page, four times
 * the 0.1 the Lighthouse budget allows and effectively the whole of that page's
 * CLS. What a skeleton is for is occupying roughly the height the real content
 * will, so that arrival moves nothing.
 *
 * Deliberately a shape rather than a set of ready-made layouts: what has to
 * match is the height of a specific page, so the layout belongs beside that
 * page, in its own module, where the two can be kept in step. This file owns
 * only what every one of them shares — which is why changing the pulse or the
 * fill is one edit rather than nine.
 */
export function Skeleton({ className }: { className?: string }) {
  // `cn` is tailwind-merge, so a caller passing its own rounding or fill
  // replaces these rather than landing a second, conflicting class beside them.
  return <div className={cn("animate-pulse rounded bg-muted", className)} />;
}

/**
 * A skeleton that stands in for a line of text.
 *
 * Widths are varied on purpose. A stack of identical bars reads as a loading
 * graphic; unequal ones read as a paragraph that has not arrived yet, which is
 * what the reader is actually waiting for.
 */
export function SkeletonText({ widths, className }: { widths: string[]; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {widths.map((width, i) => (
        <Skeleton key={i} className={cn("h-4", width)} />
      ))}
    </div>
  );
}
