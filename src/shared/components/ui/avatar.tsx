import { cn } from "@/shared/lib/utils";

export function Avatar({ size = "sm", className }: { size?: "sm" | "md"; className?: string }) {
  const sizeClass = size === "sm" ? "size-6 text-xs" : "size-10 text-base";
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted", sizeClass, className)}
    >
      <span className="material-symbols-rounded text-muted-fg">person</span>
    </div>
  );
}
