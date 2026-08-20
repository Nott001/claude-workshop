import { Skeleton, SkeletonText } from "@/shared/components/skeleton";

/**
 * The speaker's event page, before its data arrives.
 *
 * This page and the attendee's detail page show the same event and share none
 * of their layout: twelve columns split 8/4 and then 7/5 here, against the
 * attendee page's 65fr/35fr, and a 400px hero card rather than a cover panel.
 * So the placeholder is this page's own — the height it has to hold open is the
 * height of this layout, and a shared one would have to be told about both.
 *
 * It was the worst load in the app before this: a centred line of text under a
 * rail, replaced by a page nearly a thousand pixels taller, for 0.357 of layout
 * shift — more than three times the budget.
 */
export function SpeakerEventDetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading event details" className="flex flex-1 flex-col bg-bg">
      <div className="flex flex-1 flex-col px-16 pt-24 pb-12">
        <Skeleton className="mb-8 h-5 w-40" />

        <div className="grid grid-cols-12 gap-6">
          {/* The hero card, which is the tallest thing on the page. */}
          <Skeleton className="col-span-8 h-[400px] rounded-xl" />
          <div className="col-span-4 flex flex-col gap-6">
            <div className="space-y-3 rounded-xl border border-border bg-surface p-6">
              <Skeleton className="h-6 w-32" />
              <SkeletonText widths={["w-full", "w-2/3"]} />
            </div>
            <div className="space-y-3 rounded-xl border border-border bg-surface p-6">
              <Skeleton className="h-6 w-28" />
              <SkeletonText widths={["w-full", "w-3/4"]} />
            </div>
          </div>

          <div className="col-span-7">
            <div className="space-y-3 rounded-xl border border-border bg-surface p-6">
              <Skeleton className="h-6 w-40" />
              <SkeletonText widths={["w-full", "w-full", "w-4/5"]} />
            </div>
          </div>
          <div className="col-span-5">
            <div className="space-y-3 rounded-xl border border-border bg-surface p-6">
              <Skeleton className="h-6 w-36" />
              <SkeletonText widths={["w-full", "w-2/3"]} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
