"use client";

import { useSession } from "@/modules/auth/components/session-context";
import { Brand } from "@/modules/shell/components/brand";
import { Navbar } from "@/modules/shell/components/navbar";
import { ProfileMenu } from "@/modules/shell/components/profile-menu";

export function StaffNavbar() {
  const { user, isSignedIn, signOut } = useSession();

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-20 border-b border-border bg-surface">
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
