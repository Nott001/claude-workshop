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

/** The surfaces a staff rail stands on, by route rather than by role. */
const RAIL_PATH_PREFIXES = ["/staff", "/speaker"];

function shouldHideNavbar(pathname: string) {
  if (HIDE_NAVBAR_PATHS.some((path) => pathname.startsWith(path))) return true;
  return HIDE_NAVBAR_PATTERNS.some((re) => re.test(pathname));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useSession();
  const role = user?.role ?? null;
  const usesSidebar = !!role && role !== ROLES.ATTENDEE;
  // Hold the rail's width open while the session is still resolving.
  //
  // `usesSidebar` reads the role, and the role arrives a round trip after the
  // first paint — so a staff page laid its content out across the full width
  // and then jumped 72px right when the rail appeared. That single shift
  // measured 0.047 on every staff route, and was the largest source on all
  // seven of them once their skeletons were in place.
  //
  // The route knows what the session has not answered yet: these prefixes are
  // staff surfaces, and anyone who reaches one without the role for it is
  // redirected by that page's own guard. Reserving the space is not the same as
  // rendering the rail — which still waits for the role, so a stray visitor is
  // never shown the console's navigation.
  const reservesRail = usesSidebar || (loading && RAIL_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix)));

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
        {/* Both bars stand at the token's height, so one offset clears either
            — but it reads from the token rather than repeating the number, so
            the two cannot drift apart again the way they nearly did. */}
        <main className={cn("pt-navbar flex flex-1 flex-col", reservesRail && "lg:pl-[72px]")}>
          {children}
          <Footer role={role} />
        </main>
      </ErrorBoundary>
      {showAssist && <FloatingAssistButton />}
    </div>
  );
}
