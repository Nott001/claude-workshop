"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cn } from "@/shared/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-brand text-brand-fg hover:bg-brand/90 shadow-sm",
  secondary: "border border-border bg-surface text-fg hover:bg-muted",
  ghost: "text-fg hover:bg-muted",
  danger: "bg-error text-white hover:bg-error/90 shadow-sm",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-7 text-xs px-2 gap-1",
  md: "h-9 text-sm px-3 gap-1.5",
  lg: "h-10 text-sm px-4 gap-2",
  icon: "size-9",
};

/**
 * Button styling without button behavior, for elements that are already
 * interactive on their own — chiefly `<a href>`. Routing a link through
 * `Button` would apply `role="button"` and drop its link semantics.
 */
function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
    variantStyles[variant],
    sizeStyles[size],
    className,
  );
}

function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonPrimitive.Props & { variant?: ButtonVariant; size?: ButtonSize }) {
  // Base UI also allows className as a function of the button's state; resolve
  // it per state rather than letting `cn` drop it on the floor.
  const resolved =
    typeof className === "function"
      ? (state: ButtonPrimitive.State) => buttonStyles({ variant, size, className: className(state) })
      : buttonStyles({ variant, size, className });

  return <ButtonPrimitive className={resolved} {...props} />;
}

export { Button, buttonStyles, type ButtonVariant, type ButtonSize };
