"use client";

import type { ReactNode } from "react";
import { Input } from "@/shared/components/input";
import { cn } from "@/shared/lib/utils";

interface TableSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

function TableSearch({ value, onChange, placeholder, className }: TableSearchProps) {
  return (
    <div className={cn("relative", className)}>
      <span
        aria-hidden
        className="material-symbols-rounded pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base text-muted-fg"
      >
        search
      </span>
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder ?? "Search"}
        className="h-9 pr-9 pl-9 text-xs"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-fg transition-colors hover:text-fg"
        >
          <span aria-hidden className="material-symbols-rounded text-base">
            close
          </span>
        </button>
      )}
    </div>
  );
}

interface TableToolbarProps {
  search: TableSearchProps;
  className?: string;
  children?: ReactNode;
}

// Enforces the canonical order across every staff table: search above, filter
// controls below. Composing search/filters through this one component is what
// keeps the six tables from drifting into alternately-arranged toolbars again.
function TableToolbar({ search, className, children }: TableToolbarProps) {
  return (
    <div className={cn("mb-4 flex flex-col gap-3", className)}>
      <TableSearch {...search} />
      {children}
    </div>
  );
}

export { TableSearch, TableToolbar };
