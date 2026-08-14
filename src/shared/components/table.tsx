import type { KeyboardEvent, ThHTMLAttributes, TdHTMLAttributes } from "react";
import { cn } from "@/shared/lib/utils";

function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full text-left text-sm", className)} {...props} />;
}

function TableHead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={className} {...props} />;
}

function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-border", className)} {...props} />;
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

interface TableEmptyProps {
  icon?: string;
  title: string;
  hint?: string;
}

function TableEmpty({ icon, title, hint }: TableEmptyProps) {
  return (
    <div className="rounded-lg border border-border bg-muted px-4 py-8 text-center">
      {icon && <span className="material-symbols-rounded mb-1 text-2xl text-muted-fg">{icon}</span>}
      <p className="text-xs font-medium text-fg">{title}</p>
      {hint && <p className="mt-0.5 text-[10px] text-muted-fg">{hint}</p>}
    </div>
  );
}

function TableContainer({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("overflow-hidden rounded-xl border border-border bg-surface shadow-sm", className)} {...props} />;
}

export { Table, TableHead, TableBody, TableRow, TableHeadCell, TableCell, TableEmpty, TableContainer };
