import Link from "next/link";
import { cn } from "@/shared/lib/utils";

export function Brand({ className, height = 46 }: { className?: string; height?: number }) {
  const width = Math.round((height * 1765) / 680);
  return (
    // The mark sits in both bars, so it is on screen the moment any page is,
    // and the landing page it points at is rendered per request. Prefetching it
    // bought a render of `/` on every arrival anywhere in the app.
    <Link href="/" prefetch={false} className={cn("flex items-center", className)}>
      {/* 1765:680 is the logo SVG's viewBox ratio; height is locked inline because
          Tailwind's preflight forces img height to auto. */}
      <img src="/images/logo.svg" alt="StartupLab" width={width} height={height} style={{ height, width: "auto" }} />
    </Link>
  );
}
