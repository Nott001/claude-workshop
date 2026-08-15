"use client";

import { ROLES } from "@/shared/lib/roles";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/modules/auth/components/session-context";
import { cn } from "@/shared/lib/utils";
import type { UserRole } from "@/shared/types";
import { getNavItems } from "@/modules/shell/lib/nav-items";
import { Brand } from "@/modules/shell/components/brand";
import { originFromPathname, withBackLink } from "@/shared/lib/back-link";
import { ProfileMenu } from "@/modules/shell/components/profile-menu";

export function TopNavbar() {
  const pathname = usePathname();
  const { user, isSignedIn, signOut } = useSession();

  // Where the visitor is standing when they reach for sign-in, so the auth
  // screen can offer the way back to it rather than to the landing page.
  const origin = originFromPathname(pathname);

  const userRole: UserRole = (user?.role as UserRole) ?? ROLES.ATTENDEE;
  const navItems = getNavItems(isSignedIn, userRole);

  return (
    <header className="fixed inset-x-0 top-0 z-20 border-b border-border bg-surface">
      <div className="flex h-16 items-center gap-6 px-6">
        <Brand />

        <nav className="flex items-center gap-2" aria-label="Primary navigation">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition hover:bg-muted hover:text-fg",
                  isActive ? "bg-brand/10 text-brand" : "text-muted-fg",
                )}
              >
                <span className="material-symbols-rounded text-[18px]">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {isSignedIn && user ? (
            <ProfileMenu user={user} signOut={signOut} />
          ) : (
            // Signing up is the hero's "Join Now" now, so the bar carries sign-in
            // alone — in the slot sign-up used to hold.
            <Link
              href={withBackLink("/sign-in", origin)}
              className="rounded-lg px-5 py-2.5 text-xs font-semibold tracking-[0.04em] transition hover:text-brand"
            >
              SIGN IN
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
