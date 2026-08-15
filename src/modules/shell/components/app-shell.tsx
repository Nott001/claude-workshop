"use client";

import { ROLES } from "@/shared/lib/roles";
import { usePathname } from "next/navigation";
import { useSession } from "@/modules/auth/components/session-context";
import { TopNavbar } from "@/modules/shell/components/top-navbar";
import { StaffNavbar } from "@/modules/shell/components/staff-navbar";
import { FloatingAssistButton } from "@/modules/shell/components/floating-assist-button";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { ErrorBoundary } from "@/modules/shell/components/error-boundary";
import { Footer } from "@/modules/shell/components/footer";
import { cn } from "@/shared/lib/utils";

// Every screen that asks an unauthenticated visitor for credentials. The two
// password ones were missing, so a locked-out user was choosing a new password
// under a navbar inviting them to sign in.
const HIDE_NAVBAR_PATHS = ["/sign-in", "/sign-up", "/staff-login", "/forgot-password", "/reset-password"];

// Surfaces that own the whole screen and carry a bar of their own. The chrome
// is not merely redundant here: the kiosk is a tablet propped at a door, and
// the staff rail would hand the next attendee in the queue the admin console.
const HIDE_NAVBAR_PATTERNS: RegExp[] = [/^\/courses\/[^/]+\/room/, /^\/staff\/events\/[^/]+\/kiosk/];

function shouldHideNavbar(pathname: string) {
  if (HIDE_NAVBAR_PATHS.some((path) => pathname.startsWith(path))) return true;
  return HIDE_NAVBAR_PATTERNS.some((re) => re.test(pathname));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useSession();
  const role = user?.role ?? null;
  const usesSidebar = !!role && role !== ROLES.ATTENDEE;

  if (shouldHideNavbar(pathname)) {
    return <>{children}</>;
  }

  // Past the return above, only the role decides. The assist button used to
  // consult a path list of its own, but it named the same credential screens
  // and full-screen surfaces that leave here without any chrome at all, so it
  // could never be what hid the button. Hiding it on a route that does keep
  // its chrome would need a list again.
  const showAssist = !hasMinRole(role, ROLES.SPEAKER);

  return (
    <div className="flex min-h-screen">
      {usesSidebar ? <StaffNavbar /> : <TopNavbar />}
      <ErrorBoundary>
        <main className={cn("flex flex-1 flex-col pt-16", usesSidebar && "lg:pl-[72px]")}>
          {children}
          <Footer role={role} />
        </main>
      </ErrorBoundary>
      {showAssist && <FloatingAssistButton />}
    </div>
  );
}
