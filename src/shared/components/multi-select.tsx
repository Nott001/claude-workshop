"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";

export interface MultiSelectOption {
  id: number;
  label: string;
  sublabel?: string;
}

interface MultiSelectDropdownProps {
  label: string;
  options: MultiSelectOption[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  placeholder: string;
  emptyLabel: string;
  optional?: boolean;
}

/**
 * A field whose trigger reads like the other form inputs but opens a checkbox
 * list. Selection stays visible on the trigger (up to two names, then +N) and
 * the panel closes only on an outside click or Escape so several rows can be
 * ticked at once.
 */
export function MultiSelectDropdown({
  label,
  options,
  selectedIds,
  onChange,
  placeholder,
  emptyLabel,
  optional = true,
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutsideClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const selectedOptions = options.filter((o) => selectedIds.includes(o.id));
  const shown = selectedOptions.slice(0, 2);
  const hiddenCount = selectedOptions.length - shown.length;

  function toggle(id: number) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((sid) => sid !== id) : [...selectedIds, id]);
  }

  return (
    <div ref={ref} className="relative">
      <span className="mb-1.5 block text-sm font-medium text-fg">
        {label} {optional && <span className="font-normal text-muted-fg">(optional)</span>}
      </span>

      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
          open && "border-ring ring-2 ring-ring/50",
        )}
      >
        {selectedOptions.length === 0 ? (
          <span className="flex-1 text-left text-muted-fg">{placeholder}</span>
        ) : (
          <span className="flex flex-1 flex-wrap items-center gap-1.5 text-left">
            {shown.map((o) => (
              <span key={o.id} className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-fg">
                {o.label}
              </span>
            ))}
            {hiddenCount > 0 && <span className="text-xs text-muted-fg">+{hiddenCount}</span>}
          </span>
        )}
        <span className="material-symbols-rounded text-base text-muted-fg">expand_more</span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute top-full left-0 z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-elevated py-1 shadow-lg"
        >
          {options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-fg">{emptyLabel}</p>
          ) : (
            options.map((o) => (
              <label
                key={o.id}
                className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-muted"
              >
                <input type="checkbox" checked={selectedIds.includes(o.id)} onChange={() => toggle(o.id)} className="size-4" />
                <span className="truncate font-medium text-fg">{o.label}</span>
                {o.sublabel && <span className="truncate text-xs text-muted-fg">{o.sublabel}</span>}
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
