import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

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
