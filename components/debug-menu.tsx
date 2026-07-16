"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type UserRole = "attendee" | "speaker" | "facilitator";

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Sign In", href: "/sign-in" },
  { label: "Sign Up", href: "/sign-up" },
  { label: "Staff Login", href: "/staff-login" },
];

const ROLE_NAV_ITEMS: Record<UserRole, { label: string; href: string }[]> = {
  attendee: [
    { label: "Home", href: "/" },
    { label: "Events", href: "/events" },
  ],
  speaker: [
    { label: "Events", href: "/events" },
    { label: "Settings", href: "/settings" },
  ],
  facilitator: [
    { label: "Events", href: "/events" },
    { label: "Create event", href: "/events/new" },
    { label: "Courses", href: "/courses" },
    { label: "Organization", href: "/organization" },
    { label: "Kiosk", href: "/kiosk" },
  ],
};

const ROLES: { value: UserRole; label: string }[] = [
  { value: "attendee", label: "Attendee" },
  { value: "speaker", label: "Speaker" },
  { value: "facilitator", label: "Facilitator" },
];

function getCookie(name: string): string | null {
  if (typeof window === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match?.split("=")[1] ?? null;
}

function setCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}`;
}

export function DebugMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>("facilitator");
  const pathname = usePathname();
  const router = useRouter();

  const handleEnable = () => {
    setCookie("debug_mode", "true", 86400);
    setDebugEnabled(true);
    router.refresh();
  };

  const toggleDebug = () => {
    const newValue = !debugEnabled;
    setCookie("debug_mode", newValue ? "true" : "false", newValue ? 86400 : 0);
    setDebugEnabled(newValue);
    router.refresh();
  };

  const setRole = (role: UserRole) => {
    setCookie("debug_role", role, 86400);
    setSelectedRole(role);
    router.refresh();
  };

  if (!debugEnabled) {
    return (
      <button
        onClick={handleEnable}
        className={cn(
          "fixed bottom-4 right-4 z-50",
          "size-10 rounded-full bg-amber-500 text-black",
          "flex items-center justify-center text-lg font-bold",
          "shadow-lg hover:bg-amber-400 transition-colors",
        )}
        title="Enable Debug Mode"
        suppressHydrationWarning
      >
        D
      </button>
    );
  }

  const roleNavItems = ROLE_NAV_ITEMS[selectedRole];

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-4 right-4 z-50",
          "size-10 rounded-full bg-amber-500 text-black",
          "flex items-center justify-center text-lg font-bold",
          "shadow-lg hover:bg-amber-400 transition-colors",
          isOpen && "bg-amber-600",
        )}
        title="Debug Menu"
        suppressHydrationWarning
      >
        {isOpen ? "\u00d7" : "D"}
      </button>

      {isOpen && (
        <div
          className={cn(
            "fixed bottom-16 right-4 z-50",
            "w-72 rounded-lg border border-amber-500/50 bg-gray-900 shadow-xl",
            "text-sm",
          )}
        >
          <div className="border-b border-amber-500/30 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-amber-400">Debug Menu</span>
              <span className="text-xs text-amber-400/70">ACTIVE</span>
            </div>
          </div>

          <div className="border-b border-amber-500/30 p-2">
            <div className="mb-2 px-2 text-xs text-gray-400">Play as Role</div>
            <div className="flex gap-1">
              {ROLES.map((role) => (
                <button
                  key={role.value}
                  onClick={() => setRole(role.value)}
                  className={cn(
                    "flex-1 rounded px-2 py-1.5 text-xs transition-colors",
                    selectedRole === role.value
                      ? "bg-amber-500 text-black font-medium"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700",
                  )}
                >
                  {role.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-2">
            <div className="mb-2 px-2 text-xs text-gray-400">
              Quick Nav — <span className="text-amber-400 capitalize">{selectedRole}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded px-2 py-1.5 text-xs transition-colors",
                    pathname === item.href
                      ? "bg-amber-500/20 text-amber-300"
                      : "text-gray-300 hover:bg-gray-800 hover:text-white",
                  )}
                >
                  {item.label}
                </Link>
              ))}
              <div className="my-1 border-t border-gray-700" />
              {roleNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded px-2 py-1.5 text-xs transition-colors",
                    pathname === item.href
                      ? "bg-amber-500/20 text-amber-300"
                      : "text-gray-300 hover:bg-gray-800 hover:text-white",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="border-t border-amber-500/30 p-2">
            <div className="mb-2 px-2 text-xs text-gray-400">Debug Options</div>
            <button
              onClick={toggleDebug}
              className="w-full rounded px-2 py-1.5 text-left text-xs text-red-400 hover:bg-gray-800"
            >
              Disable Debug Mode
            </button>
          </div>

          <div className="border-t border-amber-500/30 px-3 py-1.5">
            <div className="text-xs text-gray-500">Path: {pathname}</div>
          </div>
        </div>
      )}
    </>
  );
}
