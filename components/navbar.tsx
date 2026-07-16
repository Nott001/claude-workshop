"use client";

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
  ],
  speaker: [
    { label: "Events", href: "/events", icon: "event" },
    { label: "Settings", href: "/settings", icon: "settings" },
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

  const userRole = (user?.publicMetadata?.role as UserRole) || "attendee";
  const navItems = isSignedIn ? ROLE_NAV_ITEMS[userRole] : [];

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <aside className="flex w-[210px] shrink-0 flex-col border-r border-border bg-elevated p-4 text-[10.5px]">
      <div className="mb-4 flex items-center gap-1.5 text-sm font-bold">
        <svg className="size-3.5 text-accent" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        StartupLab
      </div>

      <nav className="flex flex-1 flex-col gap-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-[10.5px] transition-colors",
                isActive
                  ? "bg-surface-hover font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
              )}
            >
              <span className="material-symbols-rounded text-sm">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {isSignedIn && (
        <div className="mt-auto flex items-center justify-between gap-1.5 border-t border-border pt-3">
          <div className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-accent text-[8px] font-bold text-accent-foreground">
            {getInitials(user?.firstName ?? undefined, user?.lastName ?? undefined)}
          </div>
          <button
            onClick={handleSignOut}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
            title="Sign out"
          >
            <span className="material-symbols-rounded text-sm">logout</span>
          </button>
        </div>
      )}

      {!isSignedIn && (
        <div className="mt-auto flex gap-1.5 border-t border-border pt-3">
          <Link
            href="/sign-in"
            className="flex-1 rounded-md px-2 py-1.5 text-center text-[10px] text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="flex-1 rounded-md bg-primary px-2 py-1.5 text-center text-[10px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Sign up
          </Link>
        </div>
      )}
    </aside>
  );
}
