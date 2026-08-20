import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { Skeleton } from "@/shared/components/skeleton";

/**
 * The frame every staff page sits in.
 *
 * The width is `--container-page`, shared with the public event detail page: a
 * non-attendee opening `/events/[id]` is redirected to the staff view, so the
 * two are one journey and must not change shape halfway.
 *
 * Takes no `className`, deliberately — a page that can override the column is a
 * page that can drift out of it, which is the whole of what this prevents.
 */
export function StaffPage({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-bg">
      <div className={STAFF_PAGE_CONTAINER}>{children}</div>
    </div>
  );
}

/** The measured column, named so the pages and the test that holds them aligned
 * read it from one place rather than each spelling it out. */
export const STAFF_PAGE_CONTAINER = "mx-auto w-full max-w-page px-6 py-10";

interface StaffPageHeaderProps {
  title: string;
  description?: string;
  /** Rendered opposite the title: the page's primary control, where it has one. */
  actions?: ReactNode;
}

/**
 * `items-start` rather than `items-center`: a header with a description is
 * taller than its button, and centring it leaves the control floating against
 * neither the title nor the line beneath it.
 */
export function StaffPageHeader({ title, description, actions }: StaffPageHeaderProps) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-fg">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-fg">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

/**
 * What a staff page shows instead of itself while the role guard is resolving,
 * or when the data behind it failed to load.
 *
 * `flex-1` is for the early-return case, where this replaces the whole page and
 * fills the shell's flex column; used inside a `StaffPage` it is inert.
 */
export function StaffPageState({ tone = "muted", children }: { tone?: "muted" | "error"; children: ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <p className={cn("text-sm", tone === "error" ? "text-error" : "text-muted-fg")}>{children}</p>
    </div>
  );
}

/**
 * What a staff page shows while its role guard resolves and its first rows land.
 *
 * `StaffPageState` used to serve this too, and being one centred line it left
 * the shell's flex column almost empty — so every staff page took the same
 * layout shift when its header and table arrived, measured between 0.082 and
 * 0.093 on all seven of them, from one shared cause rather than seven page
 * bugs. The error case keeps the centred line: nothing replaces it, so nothing
 * moves.
 *
 * Approximate on purpose. These pages differ — a table on most, a panel on the
 * profiler and support — but they open with the same header over the same
 * column, and reserving that plus a body of roughly the right height is what
 * the shift was made of. A per-page skeleton would buy back the last hundredth
 * at the cost of eleven more files to keep in step.
 *
 * Eleven rows is measured, not guessed: five of the seven staff pages settle at
 * exactly the height eleven reserves, so the default is the answer for most of
 * them and `rows` is for the two that list more.
 */
export function StaffPageSkeleton({ rows = 11 }: { rows?: number }) {
  return (
    <StaffPage>
      <div aria-busy="true" aria-label="Loading page">
        {/* The header, which every staff page has: title over description,
            with the primary control opposite. */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>

        <Skeleton className="mb-4 h-9 w-full max-w-sm rounded-lg" />

        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {Array.from({ length: rows }, (_, i) => (
            <Skeleton key={i} className="h-12 rounded-none" />
          ))}
        </div>
      </div>
    </StaffPage>
  );
}
