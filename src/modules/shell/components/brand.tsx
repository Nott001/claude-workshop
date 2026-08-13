import Link from "next/link";
import { cn } from "@/shared/lib/utils";

export function Brand({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2 text-[17px] font-bold tracking-[-0.02em]", className)}>
      <span className="grid size-8 place-items-center rounded-lg bg-brand text-white">
        <svg className="size-[18px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </span>
      StartupLab
    </Link>
  );
}
