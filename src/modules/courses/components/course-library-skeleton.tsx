import { Skeleton, SkeletonText } from "@/shared/components/skeleton";

/**
 * The course library's shape, before its data arrives.
 *
 * Three cards, because that is close to what an attendee who has any material
 * at all tends to have, and because the empty state this page falls back to is
 * itself a tall panel — reserving nothing here let the footer ride up and come
 * back down whichever way the request resolved.
 */
const PLACEHOLDER_COUNT = 3;

export function CourseLibrarySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your courses" className="flex flex-1 flex-col p-6 sm:p-8">
      <div className="mx-auto w-full max-w-3xl">
        {/* The real header is an icon tile beside two lines of copy. */}
        <div className="mb-8 flex items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>

        <div className="space-y-3">
          {Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-start gap-3">
                <Skeleton className="size-10 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-1/3" />
                  <SkeletonText className="mt-2" widths={["w-full", "w-2/3"]} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
