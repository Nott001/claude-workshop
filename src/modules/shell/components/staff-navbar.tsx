"use client";

import { useSession } from "@/modules/auth/components/session-context";
import { Brand } from "@/modules/shell/components/brand";
import { Navbar } from "@/modules/shell/components/navbar";
import { ProfileMenu } from "@/modules/shell/components/profile-menu";
import { NAV_BAR_SURFACE } from "@/modules/shell/lib/nav-surface";
import { cn } from "@/shared/lib/utils";

export function StaffNavbar() {
  const { user, isSignedIn, signOut } = useSession();

  return (
    <>
      {/* Frosted like the attendee bar, but still 64px: the rail below is
          pinned to that height, and staff pages are dense enough that the
          8px would come out of the content rather than out of nothing. */}
      <header className={cn(NAV_BAR_SURFACE, "fixed")}>
        <div className="flex h-16 items-center px-6">
          <Brand />
          <div className="ml-auto flex items-center gap-3">
            {isSignedIn && user ? <ProfileMenu user={user} signOut={signOut} /> : null}
          </div>
        </div>
      </header>
      <Navbar />
    </>
  );
}
