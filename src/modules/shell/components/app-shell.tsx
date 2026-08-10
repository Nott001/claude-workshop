"use client";

import { ROLES } from "@/shared/lib/roles";
import { usePathname } from "next/navigation";
import { useSession } from "@/modules/auth/components/session-context";
import { Navbar } from "@/modules/shell/components/navbar";
import { TopNavbar } from "@/modules/shell/components/top-navbar";
import { FloatingAssistButton } from "@/modules/shell/components/floating-assist-button";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { ErrorBoundary } from "@/modules/shell/components/error-boundary";
import { Footer } from "@/modules/shell/components/footer";
import { cn } from "@/shared/lib/utils";

const HIDE_NAVBAR_PATHS = ["/sign-in", "/sign-up", "/staff-login"];

const HIDE_ASSIST_PATHS = ["/sign-in", "/sign-up", "/staff-login"];
const HIDE_ASSIST_PATTERNS = [/^\/courses\/[^/]+\/room/];

const HIDE_NAVBAR_PATTERNS: RegExp[] = [/^\/courses\/[^/]+\/room/];

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
  const usesTopNav = !role || role === ROLES.ATTENDEE;
  const hideNavbar = shouldHideNavbar(pathname);
  const showAssist = !shouldHideAssist(pathname) && !hasMinRole(role, ROLES.SPEAKER);

  if (hideNavbar) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      {usesTopNav ? <TopNavbar /> : <Navbar />}
      <ErrorBoundary>
        <main className={cn("flex flex-1 flex-col overflow-auto", usesTopNav ? "pt-16" : "lg:pl-[202px]")}>
          {children}
          <Footer />
        </main>
      </ErrorBoundary>
      {showAssist && <FloatingAssistButton />}
    </div>
  );
}
