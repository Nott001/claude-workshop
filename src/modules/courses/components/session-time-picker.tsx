"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { formatTime } from "@/shared/lib/date-utils";
import type { TimeOption } from "../lib/schedule-options";

export type TimeField = "start" | "end";

interface SessionTimePickerProps {
  modName: string;
  startValue: string;
  endValue: string;
  startOptions: TimeOption[];
  endOptions: TimeOption[];
  invalid: boolean;
  issueMessage?: string | null;
  /** A module outside edit mode shows its window but will not open the picker. */
  disabled?: boolean;
  onChange: (field: TimeField, value: string) => void;
}

function displayTimes(startValue: string, endValue: string): string {
  if (!startValue && !endValue) return "Not scheduled";
  const start = startValue ? formatTime(startValue) : "Not set";
  const end = endValue ? formatTime(endValue) : "Not set";
  return `${start} – ${end}`;
}

export function SessionTimePicker({
  modName,
  startValue,
  endValue,
  startOptions,
  endOptions,
  invalid,
  issueMessage,
  disabled = false,
  onChange,
}: SessionTimePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Session time for ${modName}`}
        className={cn(
          "flex items-center gap-1.5 rounded-md border bg-surface px-2.5 py-1 text-xs text-fg outline-none focus:ring-2",
          invalid
            ? "border-error/70 focus:border-error focus:ring-error/20"
            : "border-border focus:border-brand focus:ring-ring/20",
        )}
      >
        <span className="material-symbols-rounded text-[14px] text-muted-fg">schedule</span>
        <span className={cn("flex-1 text-left", !startValue && !endValue && "text-muted-fg")}>
          {displayTimes(startValue, endValue)}
        </span>
        <span className="material-symbols-rounded text-[14px] text-muted-fg">expand_more</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 flex w-[340px] flex-col gap-2 rounded-lg border border-border bg-surface p-2 shadow-lg">
          <div className="flex gap-2">
            <TimeColumn
              title="Start"
              modName={modName}
              value={startValue}
              options={startOptions}
              onSelect={(value) => onChange("start", value)}
            />
            <TimeColumn
              title="End"
              modName={modName}
              value={endValue}
              options={endOptions}
              onSelect={(value) => onChange("end", value)}
            />
          </div>
          {issueMessage && <p className={cn("text-xs", invalid ? "text-error" : "text-muted-fg")}>{issueMessage}</p>}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="self-end rounded-md px-2 py-1 text-xs font-medium text-muted-fg transition-colors hover:bg-muted hover:text-fg"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

function TimeColumn({
  title,
  modName,
  value,
  options,
  onSelect,
}: {
  title: string;
  modName: string;
  value: string;
  options: TimeOption[];
  onSelect: (value: string) => void;
}) {
  return (
    <div className="flex-1">
      <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-fg">{title}</p>
      <div role="listbox" aria-label={`${title} time for ${modName}`} className="max-h-52 overflow-y-auto">
        <TimeOptionRow label="Not scheduled" selected={value === ""} onSelect={() => onSelect("")} />
        {options.map((option) => (
          <TimeOptionRow
            key={option.value}
            label={option.label}
            booked={option.disabled}
            selected={value === option.value}
            onSelect={() => onSelect(option.value)}
          />
        ))}
      </div>
    </div>
  );
}

function TimeOptionRow({
  label,
  booked = false,
  selected,
  onSelect,
}: {
  label: string;
  booked?: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        "block w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted",
        booked ? "text-muted-fg/60" : "text-fg",
        selected && "bg-brand/10 font-medium text-brand",
      )}
    >
      {label}
    </button>
  );
}
