"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Navbar } from "@/components/navbar";
import { FloatingAssistButton } from "@/components/floating-assist-button";

const HIDE_NAVBAR_PATHS = ["/sign-in", "/sign-up", "/staff-login"];

const HIDE_ASSIST_PATHS = ["/sign-in", "/sign-up", "/staff-login"];
const HIDE_ASSIST_PATTERNS = [/^\/events\/[^/]+\/room/];

function shouldHideAssist(pathname: string) {
  if (HIDE_ASSIST_PATHS.some((path) => pathname.startsWith(path))) return true;
  return HIDE_ASSIST_PATTERNS.some((re) => re.test(pathname));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isSignedIn } = useUser();
  const [role, setRole] = useState<string | null>(null);
  const hideNavbar = HIDE_NAVBAR_PATHS.some((path) => pathname.startsWith(path));

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.role) setRole(data.role);
      })
      .catch(() => {});
  }, [isSignedIn]);

  if (hideNavbar) {
    return <>{children}</>;
  }

  const showAssist = !shouldHideAssist(pathname) && role !== "facilitator";

  return (
    <div className="flex min-h-screen">
      <Navbar />
      <main className="flex flex-1 flex-col overflow-auto lg:pl-[202px]">{children}</main>
      {showAssist && <FloatingAssistButton />}
    </div>
  );
}
