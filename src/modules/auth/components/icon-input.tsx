"use client";

import * as React from "react";
import { Input } from "@/shared/components/input";
import { cn } from "@/shared/lib/utils";

interface IconInputProps extends React.ComponentProps<"input"> {
  /**
   * Material Symbols ligature naming the field, decorative by definition — the
   * label says what it is. Omitted where the design leaves the field bare.
   */
  icon?: string;
  /** Rendered over the trailing edge, for a control the field owns such as a reveal toggle. */
  endAdornment?: React.ReactNode;
}

/**
 * The auth form's field shape: the shared Input at the size both auth screens
 * draw it, with room made for whatever sits inside its edges.
 *
 * The padding that clears an adornment lives here rather than at each call
 * site, because a field that forgets it prints its own value underneath.
 */
function IconInput({ icon, endAdornment, className, ...props }: IconInputProps) {
  return (
    <div className="relative">
      {icon && (
        <span
          aria-hidden
          className="material-symbols-rounded pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[18px] text-muted-fg"
        >
          {icon}
        </span>
      )}
      <Input className={cn("h-12 text-base", icon ? "pl-11" : "px-4", endAdornment && "pr-11", className)} {...props} />
      {endAdornment}
    </div>
  );
}

export { IconInput };
