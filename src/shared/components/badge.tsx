import { cn } from "@/shared/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info";

// The tint carries the meaning; the label is read. Matching the text to its own
// wash left each pill a single hue at two strengths, and on white that measured
// 1.97:1 for `warning` — the label was very nearly the fill. The label now sits
// at `muted-fg`, the weight the table's secondary columns already read at, which
// clears AA against every tint in light mode.
//
// Dark mode takes `fg` instead. Its `muted-fg` clears AA against the bare
// surface by 4.81:1 and has nothing left to spend, so laying a tint underneath
// dropped all four variants under the line; `fg` restores 7:1 and up. The cost
// is that the label stops matching the muted body text in dark mode only, which
// is the cheaper half of the trade.
const badgeStyles: Record<BadgeVariant, string> = {
  default: "bg-muted text-muted-fg dark:text-fg",
  success: "bg-success/20 text-muted-fg dark:text-fg",
  warning: "bg-warning/20 text-muted-fg dark:text-fg",
  error: "bg-error/20 text-muted-fg dark:text-fg",
  info: "bg-info/20 text-muted-fg dark:text-fg",
};

export function Badge({
  variant = "default",
  className,
  children,
}: {
  variant?: BadgeVariant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold",
        badgeStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
