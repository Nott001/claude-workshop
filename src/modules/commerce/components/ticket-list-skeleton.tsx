import { Skeleton } from "@/shared/components/skeleton";

/**
 * The ticket list's shape, before its data arrives.
 *
 * Deliberately its own file rather than a shared "list page" skeleton with the
 * course library's: the two share a header and nothing else that matters here.
 * A ticket card is a banded panel with a QR beside it and is several times the
 * height of a course row, and height is the entire reason this exists — sharing
 * the half that is the same would mean parameterising the half that is not.
 */
const PLACEHOLDER_COUNT = 2;

export function TicketListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your tickets" className="flex flex-1 flex-col p-6 sm:p-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 flex items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-border bg-surface">
              {/* The card leads with a coloured band carrying the event title. */}
              <Skeleton className="h-24 rounded-none" />
              <div className="space-y-3 px-6 py-5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-3/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
