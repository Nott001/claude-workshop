import type { KeyboardEvent, ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";
import { cn } from "@/shared/lib/utils";
import { Skeleton } from "@/shared/components/skeleton";

function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full table-fixed text-left text-sm", className)} {...props} />;
}

function TableHead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("border-b border-border bg-muted", className)} {...props} />;
}

interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  // True while a refetch is in flight with rows already on screen: rows are
  // dimmed, not unmounted, so the table keeps its shape.
  busy?: boolean;
}

function TableBody({ className, busy, ...props }: TableBodyProps) {
  return (
    <tbody
      className={cn("divide-y divide-border transition-opacity duration-200", busy && "opacity-60", className)}
      aria-busy={busy || undefined}
      {...props}
    />
  );
}

function TableHeadCell({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("px-5 py-3 font-semibold text-muted-fg", className)} {...props} />;
}

function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-5 py-4", className)} {...props} />;
}

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  onClick?: () => void;
  "aria-label"?: string;
}

function TableRow({ className, onClick, children, ...props }: TableRowProps) {
  if (!onClick) {
    return (
      <tr className={className} {...props}>
        {children}
      </tr>
    );
  }

  const handleRowClick = onClick;

  function handleKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleRowClick();
    }
  }

  return (
    <tr
      className={cn(
        "cursor-pointer transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
        className,
      )}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {children}
    </tr>
  );
}

interface TableBodyStateProps {
  /** True once at least one row is ready to render. */
  ready: boolean;
  loading: boolean;
  /** Column count, used to span the loading/empty row across the header width. */
  colSpan: number;
  empty: { icon?: string; title: string; hint?: string };
  /**
   * How many placeholder rows to hold open while loading.
   *
   * Eleven is what the staff pages measured: it is the height five of the seven
   * settle at, so it is right for most and the two that list more say so.
   */
  loadingRows?: number;
  children: ReactNode;
}

// The body's state handled without ever unmounting the header: rows render
// as-is (dimmed by TableBody's busy while a refetch is in flight), otherwise
// loading and empty become single rows spanning the full header width.
function TableBodyState({ ready, loading, colSpan, empty, loadingRows = 11, children }: TableBodyStateProps) {
  if (ready) return <>{children}</>;

  if (loading) {
    // Placeholder rows rather than one centred spinner. A spinner row is about
    // a tenth the height of the rows it stands in for, so every staff table
    // grew by some four hundred pixels when its data landed and pushed the
    // whole page down with it — one shared cause behind a layout shift on all
    // six of them. Rows of roughly the right height move nothing.
    return (
      <>
        {Array.from({ length: loadingRows }, (_, i) => (
          <tr key={i}>
            <td colSpan={colSpan} className="px-5 py-3">
              <Skeleton className="h-5" />
            </td>
          </tr>
        ))}
      </>
    );
  }

  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-12 text-center">
        {empty.icon && (
          <span aria-hidden className="material-symbols-rounded mb-1 text-2xl text-muted-fg">
            {empty.icon}
          </span>
        )}
        <p className="text-xs font-medium text-fg">{empty.title}</p>
        {empty.hint && <p className="mt-0.5 text-[10px] text-muted-fg">{empty.hint}</p>}
      </td>
    </tr>
  );
}

function TableContainer({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("overflow-hidden rounded-xl border border-border bg-surface shadow-sm", className)} {...props} />;
}

export { Table, TableHead, TableBody, TableRow, TableHeadCell, TableCell, TableBodyState, TableContainer };
