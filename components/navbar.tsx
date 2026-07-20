"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

type UserRole = "attendee" | "speaker" | "facilitator";

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const ROLE_NAV_ITEMS: Record<UserRole, NavItem[]> = {
  attendee: [
    { label: "Home", href: "/", icon: "home" },
    { label: "Events", href: "/events", icon: "event" },
    { label: "Tickets", href: "/tickets", icon: "confirmation_number" },
  ],
  speaker: [
    { label: "Events", href: "/speakers/dashboard", icon: "event" },
  ],
  facilitator: [
    { label: "Events", href: "/events", icon: "event" },
    { label: "Create event", href: "/events/new", icon: "add_circle" },
    { label: "Courses", href: "/courses", icon: "school" },
    { label: "Create course", href: "/courses/new", icon: "post_add" },
    { label: "Organization", href: "/organization", icon: "groups" },
    { label: "Kiosk", href: "/kiosk", icon: "qr_code_scanner" },
    { label: "Surveys", href: "/surveys", icon: "poll" },
  ],
};

const GUEST_NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/", icon: "home" },
  { label: "Events", href: "/events", icon: "event" },
];

function getInitials(firstName?: string, lastName?: string): string {
  const first = firstName?.charAt(0) || "";
  const last = lastName?.charAt(0) || "";
  return (first + last).toUpperCase();
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const [dbRole, setDbRole] = useState<UserRole | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.role) setDbRole(data.role as UserRole);
      })
      .catch(() => {});
  }, [isSignedIn]);

  const userRole: UserRole = dbRole ?? "attendee";
  const navItems = isSignedIn ? ROLE_NAV_ITEMS[userRole] : GUEST_NAV_ITEMS;

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[202px] flex-col border-r border-[#bdc8d0] bg-white px-5 py-7 lg:flex">
      <Link href="/" className="flex items-center gap-2 text-[17px] font-bold tracking-[-0.02em]">
        <span className="grid size-8 place-items-center rounded-lg bg-[#3db9ee] text-white">
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
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive ? "bg-[#e8f8fe] text-[#1789b8]" : "text-[#647078] hover:bg-[#f4f7f8] hover:text-[#1b1c1c]",
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
            <div className="flex items-center gap-2 rounded-lg bg-[#f4f7f8] px-3 py-2">
              <div className="grid size-7 place-items-center rounded-full bg-[#3db9ee] text-[10px] font-bold text-white">
                {getInitials(user?.firstName ?? undefined, user?.lastName ?? undefined) ||
                  (user?.emailAddresses?.[0]?.emailAddress?.charAt(0) ?? "?").toUpperCase()}
              </div>
              <span className="truncate text-sm font-medium text-[#1b1c1c]">
                {user?.firstName
                  ? `${user.firstName} ${user.lastName ?? ""}`
                  : (user?.emailAddresses?.[0]?.emailAddress ?? "User")}
              </span>
            </div>
            <Link
              href="/user"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#bdc8d0] py-2.5 text-xs font-semibold tracking-[0.04em] text-[#647078] transition hover:border-[#3db9ee] hover:text-[#1789b8]"
            >
              <span className="material-symbols-rounded text-[16px]">settings</span>
              Settings
            </Link>
            <button
              onClick={handleSignOut}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#bdc8d0] py-2.5 text-xs font-semibold tracking-[0.04em] text-[#647078] transition hover:border-[#e5484d] hover:text-[#e5484d]"
            >
              <span className="material-symbols-rounded text-[16px]">logout</span>
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link
              href="/sign-in"
              className="block rounded-lg border border-[#bdc8d0] py-2.5 text-center text-xs font-semibold tracking-[0.04em] transition hover:border-[#3db9ee] hover:text-[#1789b8]"
            >
              SIGN IN
            </Link>
            <Link
              href="/sign-up"
              className="block rounded-lg bg-[#3db9ee] py-2.5 text-center text-xs font-semibold tracking-[0.04em] text-white transition hover:bg-[#239dce]"
            >
              SIGN UP
            </Link>
          </>
        )}
      </div>
    </aside>
  );
}
