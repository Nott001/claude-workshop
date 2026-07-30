"use client";

import { usePathname } from "next/navigation";
import { useSession } from "@/modules/auth";
import { Navbar } from "@/shared/components/navbar";
import { FloatingAssistButton } from "@/modules/support/components/floating-assist-button";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { ErrorBoundary } from "@/shared/components/ui/error-boundary";

const HIDE_NAVBAR_PATHS = ["/sign-in", "/sign-up", "/staff-login"];

const HIDE_ASSIST_PATHS = ["/sign-in", "/sign-up", "/staff-login"];
const HIDE_ASSIST_PATTERNS = [/^\/events\/[^/]+\/room/];

const HIDE_NAVBAR_PATTERNS: RegExp[] = [/^\/events\/[^/]+\/room/];

function shouldHideNavbar(pathname: string) {
  if (HIDE_NAVBAR_PATHS.some((path) => pathname.startsWith(path))) return true;
  return HIDE_NAVBAR_PATTERNS.some((re) => re.test(pathname));
}

function shouldHideAssist(pathname: string) {
  if (HIDE_ASSIST_PATHS.some((path) => pathname.startsWith(path))) return true;
  return HIDE_ASSIST_PATTERNS.some((re) => re.test(pathname));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useSession();
  const role = user?.role ?? null;
  const hideNavbar = shouldHideNavbar(pathname);
  const showAssist = !shouldHideAssist(pathname) && !hasMinRole(role, "speaker");

  if (hideNavbar) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Navbar />
      <ErrorBoundary>
        <main className="flex flex-1 flex-col overflow-auto lg:pl-[202px]">{children}</main>
      </ErrorBoundary>
      {showAssist && <FloatingAssistButton />}
    </div>
  );
}
