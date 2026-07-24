import Link from "next/link";
import { cn } from "@/lib/utils";

interface AuthLayoutProps {
  children: React.ReactNode;
  alternateAction?: {
    label: string;
    href: string;
  };
  className?: string;
}

export function AuthLayout({ children, alternateAction, className }: AuthLayoutProps) {
  return (
    <div className={cn("flex min-h-screen flex-col", className)}>
      <nav className="flex items-center justify-between border-b border-border bg-elevated px-6 py-3">
        <div className="flex items-center gap-2">
          <svg className="size-5 text-accent" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-foreground text-sm font-bold">StartupLab Business Center</span>
        </div>
        {alternateAction && (
          <Link href={alternateAction.href} className="text-foreground text-sm font-semibold hover:underline">
            {alternateAction.label}
          </Link>
        )}
      </nav>

      <div className="grid flex-1 grid-cols-2">
        <div className="flex flex-col justify-center gap-3 bg-gradient-to-br from-blue-900/30 to-background p-10">
          <div className="max-w-[220px] text-lg font-bold leading-snug text-foreground">
            Empowering the next generation of founders.
          </div>
          <div className="max-w-[220px] text-xs text-muted-foreground">
            Join a community of innovators and scale your business at StartupLab.
          </div>
        </div>

        <div className="flex items-center justify-center p-8">{children}</div>
      </div>
    </div>
  );
}
