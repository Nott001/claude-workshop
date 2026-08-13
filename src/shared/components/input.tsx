import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "@/shared/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      className={cn(
        "h-9 w-full min-w-0 rounded-lg border border-border bg-surface px-3 py-1 text-sm text-fg transition-colors outline-none placeholder:text-muted-fg focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        // Carries the rejection on the control itself, so the field is findable
        // at a glance and the adjacent message explains a border the eye has
        // already landed on. Callers only set aria-invalid; the styling follows.
        "aria-[invalid=true]:border-error aria-[invalid=true]:focus-visible:border-error aria-[invalid=true]:focus-visible:ring-error/40",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
