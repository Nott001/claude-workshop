import { Skeleton, SkeletonText } from "@/shared/components/skeleton";

/**
 * The event detail page's shape, before its data arrives.
 *
 * It mirrors the real page's containers rather than approximating them —
 * `max-w-page`, the same gutters, the same `65fr_35fr` split and the same
 * `min-h-[320px] lg:min-h-[400px]` cover — because the point is that nothing
 * moves when the two swap. The page used to render one line of centred text
 * here, which let the footer sit mid-viewport and then took a 0.425 layout
 * shift when the real page pushed it back down.
 *
 * The aside is reproduced too, and it is the half that matters most: it holds
 * the register card, which is the tallest thing on the page after the cover and
 * the reason the footer was so far out of place.
 */
export function EventDetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading event" className="flex flex-1 flex-col bg-bg">
      <div className="mx-auto w-full max-w-page px-5 py-12 sm:px-8">
        <Skeleton className="mb-6 h-5 w-32" />

        <div className="grid gap-6 lg:grid-cols-[65fr_35fr]">
          <Skeleton className="min-h-[320px] rounded-xl lg:min-h-[400px]" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <SkeletonText widths={["w-1/2", "w-2/3", "w-1/3"]} />
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[65fr_35fr]">
          <div className="min-w-0 space-y-6">
            <div className="rounded-xl border border-border bg-surface p-6 sm:p-7">
              <Skeleton className="h-6 w-40" />
              <SkeletonText className="mt-3" widths={["w-full", "w-full", "w-4/5"]} />
            </div>
            <div className="rounded-xl border border-border bg-surface p-6 sm:p-7">
              <Skeleton className="h-6 w-32" />
              <SkeletonText className="mt-3" widths={["w-full", "w-3/4"]} />
            </div>
          </div>
          <div className="space-y-6">
            {/* Roughly the register card: a heading, the seat line, and the
                button that decides this column's height. */}
            <div className="space-y-4 rounded-xl border border-border bg-surface p-6">
              <Skeleton className="h-6 w-28" />
              <SkeletonText widths={["w-2/3", "w-1/2"]} />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
            <div className="space-y-3 rounded-xl border border-border bg-surface p-6">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
