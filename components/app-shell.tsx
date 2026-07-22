"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/navbar";

const HIDE_NAVBAR_PATHS = ["/sign-in", "/sign-up", "/staff-login"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNavbar = HIDE_NAVBAR_PATHS.some((path) => pathname.startsWith(path));

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
