import Link from "next/link";
import { cn } from "@/shared/lib/utils";

export function Brand({ className, height = 46 }: { className?: string; height?: number }) {
  const width = Math.round((height * 1765) / 680);
  return (
    <Link href="/" className={cn("flex items-center", className)}>
      {/* 1765:680 is the logo SVG's viewBox ratio; height is locked inline because
          Tailwind's preflight forces img height to auto. */}
      <img src="/images/logo.svg" alt="StartupLab" width={width} height={height} style={{ height, width: "auto" }} />
    </Link>
  );
}
