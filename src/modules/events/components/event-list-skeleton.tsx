/**
 * Placeholder cards shown while the event list loads.
 *
 * Not decoration: the app shell renders the footer with `mt-auto`, so a short
 * loading state parks it inside the viewport and the arriving list then shoves
 * it down — a 0.141 layout shift on /events, and the whole of that page's CLS.
 * Occupying roughly the loaded height keeps the footer below the fold, where
 * moving it costs nothing.
 */
const PLACEHOLDER_COUNT = 6;

export function EventListSkeleton() {
  return (
    <div className="flex flex-1 flex-col p-5" aria-busy="true" aria-label="Loading events">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-base font-bold text-foreground">Event list</span>
      </div>

      <div className="mb-3 flex gap-1.5">
        <div className="h-6 w-24 animate-pulse rounded-md bg-surface-hover" />
        <div className="h-6 w-24 animate-pulse rounded-md bg-surface-hover" />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-border bg-surface">
            {/* Matches the card's h-48 cover so the two heights line up. */}
            <div className="h-48 animate-pulse bg-surface-hover" />
            <div className="space-y-3 p-6">
              <div className="h-5 w-3/4 animate-pulse rounded bg-surface-hover" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-surface-hover" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-surface-hover" />
              <div className="mt-6 h-4 w-28 animate-pulse rounded bg-surface-hover" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
