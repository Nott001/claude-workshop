"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/modules/auth";
import { cn } from "@/shared/lib/utils";
import type { UserRole } from "@/shared/types";

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const ROLE_NAV_ITEMS: Partial<Record<UserRole, NavItem[]>> = {
  attendee: [
    { label: "Home", href: "/home", icon: "home" },
    { label: "Events", href: "/events", icon: "event" },
    { label: "Tickets", href: "/tickets", icon: "confirmation_number" },
  ],
  speaker: [{ label: "Dashboard", href: "/speaker/dashboard", icon: "event" }],
  facilitator: [{ label: "Events", href: "/staff/events", icon: "event" }],
  admin: [
    { label: "Events", href: "/staff/events", icon: "event" },
    { label: "Create event", href: "/staff/events/new", icon: "add_circle" },
    { label: "Courses", href: "/staff/courses", icon: "school" },
    { label: "Organization", href: "/staff/organization", icon: "groups" },
    { label: "Emails", href: "/staff/emails", icon: "mail" },
    { label: "Support", href: "/staff/support", icon: "support_agent" },
    { label: "Audit Logs", href: "/staff/audit-logs", icon: "history" },
  ],
  super_admin: [
    { label: "Events", href: "/staff/events", icon: "event" },
    { label: "Create event", href: "/staff/events/new", icon: "add_circle" },
    { label: "Courses", href: "/staff/courses", icon: "school" },
    { label: "Organization", href: "/staff/organization", icon: "groups" },
    { label: "Emails", href: "/staff/emails", icon: "mail" },
    { label: "Support", href: "/staff/support", icon: "support_agent" },
    { label: "Audit Logs", href: "/staff/audit-logs", icon: "history" },
  ],
};

const GUEST_NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/", icon: "home" },
  { label: "Events", href: "/events", icon: "event" },
];

function getInitials(fullName?: string | null): string {
  const parts = (fullName ?? "").trim().split(/\s+/);
  const first = parts[0]?.charAt(0) || "";
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase();
}

export function Navbar() {
  const pathname = usePathname();
  const { user, isSignedIn, signOut } = useSession();
  const [customPhoto, setCustomPhoto] = useState<string | null>(null);

  const userRole: UserRole = (user?.role as UserRole) ?? "attendee";
  const navItems = isSignedIn ? (ROLE_NAV_ITEMS[userRole] ?? ROLE_NAV_ITEMS.attendee!) : GUEST_NAV_ITEMS;
  const profilePhoto = customPhoto ?? user?.profile_image_url ?? null;

  useEffect(() => {
    if (!isSignedIn) return;

    if (!user?.profile_image_url && !customPhoto) {
      fetch("/api/auth/me")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.photo_url) setCustomPhoto(data.photo_url);
        })
        .catch(() => {});
    }

    const handlePhotoUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.photoUrl) setCustomPhoto(detail.photoUrl);
    };
    window.addEventListener("profile-photo-updated", handlePhotoUpdate);
    return () => window.removeEventListener("profile-photo-updated", handlePhotoUpdate);
  }, [isSignedIn, user?.profile_image_url, customPhoto]);

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
