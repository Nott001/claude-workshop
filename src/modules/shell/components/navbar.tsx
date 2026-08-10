"use client";

import { ROLES } from "@/shared/lib/roles";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/modules/auth/components/session-context";
import { cn } from "@/shared/lib/utils";
import type { UserRole } from "@/shared/types";
import { getNavItems } from "@/modules/shell/lib/nav-items";
import { getInitials, useProfilePhoto } from "@/modules/shell/lib/profile";

export function Navbar() {
  const pathname = usePathname();
  const { user, isSignedIn, signOut } = useSession();

  const userRole: UserRole = (user?.role as UserRole) ?? ROLES.ATTENDEE;
  const navItems = getNavItems(isSignedIn, userRole);
  const profilePhoto = useProfilePhoto(user);

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[202px] flex-col border-r border-border bg-surface px-5 py-7 lg:flex">
      <Link href="/" className="flex items-center gap-2 text-[17px] font-bold tracking-[-0.02em]">
        <span className="grid size-8 place-items-center rounded-lg bg-brand text-white">
          <svg className="size-[18px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </span>
        StartupLab
      </Link>

      <nav className="mt-12 space-y-2" aria-label="Primary navigation">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 -mx-5 px-5 py-3.5 rounded-none text-sm font-medium [transition:color_400ms_cubic-bezier(0.25,0.1,0.25,1)_150ms,background-color_400ms_cubic-bezier(0.25,0.1,0.25,1)_150ms] hover:[transition:color_0ms] hover:bg-muted hover:text-fg",
                isActive ? "-mx-5 px-5 py-3.5 rounded-none bg-brand/10 text-brand" : "text-muted-fg",
              )}
            >
              <span className="material-symbols-rounded text-[18px]">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3">
        {isSignedIn ? (
          <>
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
              {profilePhoto ? (
                <img src={profilePhoto} alt="Profile" className="size-7 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-[10px] font-bold text-white">
                  {getInitials(user?.full_name) || (user?.email?.charAt(0) ?? "?").toUpperCase()}
                </div>
              )}
              <span className="truncate text-sm font-medium text-fg">{user?.full_name ?? user?.email ?? "User"}</span>
            </div>
            <Link
              href="/user"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-xs font-semibold tracking-[0.04em] text-muted-fg transition hover:border-brand hover:text-brand"
            >
              <span className="material-symbols-rounded text-[16px]">settings</span>
              Settings
            </Link>
            <button
              onClick={signOut}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-xs font-semibold tracking-[0.04em] text-muted-fg transition hover:border-error hover:text-error"
            >
              <span className="material-symbols-rounded text-[16px]">logout</span>
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link
              href="/sign-in"
              className="block rounded-lg border border-border py-2.5 text-center text-xs font-semibold tracking-[0.04em] transition hover:border-brand hover:text-brand"
            >
              SIGN IN
            </Link>
            <Link
              href="/sign-up"
              className="block rounded-lg bg-brand py-2.5 text-center text-xs font-semibold tracking-[0.04em] text-white transition hover:bg-brand/90"
            >
              SIGN UP
            </Link>
          </>
        )}
      </div>
    </aside>
  );
}
