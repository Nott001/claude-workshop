"use client";

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

interface FilterTab<K extends string = string> {
  key: K;
  label: string;
}

interface FilterTabsProps<K extends string = string> {
  tabs: FilterTab<K>[];
  active: K;
  onChange: (key: K) => void;
  counts?: Record<string, number>;
  className?: string;
}

function FilterTabs<K extends string = string>({ tabs, active, onChange, counts, className }: FilterTabsProps<K>) {
  return (
    <div className={cn("flex gap-1.5", className)}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        const count = counts?.[tab.key];
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            aria-pressed={isActive}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors",
              isActive ? "bg-brand/10 text-brand" : "bg-muted text-muted-fg hover:bg-muted",
            )}
          >
            {tab.label}
            {count !== undefined && ` (${count})`}
          </button>
        );
      })}
    </div>
  );
}

export { TableSearch, FilterTabs, type FilterTab };
