"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/navbar";

const HIDE_NAVBAR_PATHS = ["/sign-in", "/sign-up", "/staff-login"];

const HIDE_NAVBAR_PATTERNS = [/^\/events\/[^/]+\/room/];

function shouldHideNavbar(pathname: string) {
  if (HIDE_NAVBAR_PATHS.some((path) => pathname.startsWith(path))) return true;
  return HIDE_NAVBAR_PATTERNS.some((re) => re.test(pathname));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNavbar = shouldHideNavbar(pathname);

  if (hideNavbar) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Navbar />
      <main className="flex flex-1 flex-col overflow-auto lg:pl-[202px]">{children}</main>
    </div>
  );
}
