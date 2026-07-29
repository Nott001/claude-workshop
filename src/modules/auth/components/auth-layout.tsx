"use client";

import { useSession } from "@/modules/auth";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  useSession();

  return (
    <div className="flex min-h-screen flex-col">
      <nav className="flex items-center justify-between border-b border-border bg-elevated px-6 py-3">
        <div className="flex items-center gap-2">
          <svg className="size-5 text-accent" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-foreground text-sm font-bold">StartupLab Business Center</span>
        </div>
      </nav>

      <div className="grid flex-1 grid-cols-1 md:grid-cols-2">
        <div className="relative hidden flex-col justify-center gap-3 overflow-hidden bg-gradient-to-br from-blue-900/30 to-background p-10 md:flex">
          <div className="absolute inset-0 bg-[radial-gradient(var(--brand)_1px,transparent_1px)] [background-size:24px_24px] opacity-20" />
          <div className="relative max-w-[220px] text-lg font-bold leading-snug text-foreground">
            Empowering the next generation of founders.
          </div>
          <div className="relative max-w-[220px] text-xs text-muted-foreground">
            Join a community of innovators and scale your business at StartupLab.
          </div>
        </div>

        <div className="flex items-center justify-center p-8">{children}</div>
      </div>
    </div>
  );
}
