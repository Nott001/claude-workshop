"use client";

import { ROLES } from "@/shared/lib/roles";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/modules/auth/components/session-context";
import { cn } from "@/shared/lib/utils";
import type { UserRole } from "@/shared/types";
import { getNavItems } from "@/modules/shell/lib/nav-items";

export function Navbar() {
  const pathname = usePathname();
  const { user, isSignedIn } = useSession();

  const userRole: UserRole = (user?.role as UserRole) ?? ROLES.ATTENDEE;
  const navItems = getNavItems(isSignedIn, userRole);

  return (
    // Expand on hover or keyboard focus only. A mouse-clicked link keeps focus
    // across navigation, so plain :focus-within would pin the rail open until
    // focus moves; :focus-visible matches keyboard focus alone.
    <aside className="group fixed bottom-0 left-0 top-16 z-10 hidden w-[72px] flex-col overflow-hidden border-r border-border bg-surface py-5 pl-3 transition-[width] duration-300 hover:w-[202px] has-[:focus-visible]:w-[202px] lg:flex">
      <nav className="space-y-2" aria-label="Primary navigation">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              // Every item here is a dynamic route, so the default `auto` makes
              // the rail issue one server render per link the moment it mounts
              // — six at once for an admin. On the Free plan that burst is what
              // Cloudflare kills: a 15-minute capture caught 12 of 14
              // `exceededCpu` invocations inside one second, five of them these
              // links. Prefetching is production-only, which is why `next dev`
              // never shows it.
              prefetch={false}
              className={cn(
                "relative flex w-full items-center rounded-md px-3 py-3.5 text-sm font-medium text-nowrap transition",
                "after:absolute after:inset-y-0 after:right-0 after:w-[3px] after:bg-brand after:opacity-0",
                isActive ? "text-brand after:opacity-100" : "text-muted-fg/80 hover:text-fg",
              )}
            >
              <span className="flex w-6 shrink-0 items-center justify-center">
                <span className="material-symbols-rounded text-[18px]">{item.icon}</span>
              </span>
              <span className="max-w-0 overflow-hidden text-nowrap opacity-0 transition-[max-width,margin-left,opacity] duration-300 group-hover:ml-3 group-hover:max-w-[140px] group-hover:opacity-100 group-has-[:focus-visible]:ml-3 group-has-[:focus-visible]:max-w-[140px] group-has-[:focus-visible]:opacity-100">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
