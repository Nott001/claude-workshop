"use client";

import { ROLES } from "@/shared/lib/roles";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/modules/auth/components/session-context";
import { cn } from "@/shared/lib/utils";
import type { UserRole } from "@/shared/types";
import { getNavItems } from "@/modules/shell/lib/nav-items";
import { Brand } from "@/modules/shell/components/brand";
import { originFromPathname, withBackLink } from "@/shared/lib/back-link";
import { ProfileMenu } from "@/modules/shell/components/profile-menu";

/**
 * `minimal` is the bar an auth screen wants: the mark and nothing else.
 *
 * The full bar cannot serve there, and not only because the links are noise on
 * a page with one job — it offers SIGN UP to a signed-out visitor, which on the
 * sign-up page is a button pointing at the page they are already looking at. It
 * also scrolls with the page rather than pinning, since a form is the whole
 * screen and there is nothing to navigate back to while filling it in.
 */
export function TopNavbar({ minimal = false }: { minimal?: boolean }) {
  const pathname = usePathname();
  const { user, isSignedIn, signOut } = useSession();

  // Where the visitor is standing when they reach for sign-in, so the auth
  // screen can offer the way back to it rather than to the landing page.
  const origin = originFromPathname(pathname);

  const userRole: UserRole = (user?.role as UserRole) ?? ROLES.ATTENDEE;
  const navItems = minimal ? [] : getNavItems(isSignedIn, userRole);

  return (
    <header className={cn("inset-x-0 top-0 z-20 border-b border-border bg-surface", minimal ? "sticky" : "fixed")}>
      {/* Minimal keeps the mark over the content column it sits above, which is
          inset further than the app's own gutter. */}
      <div className={cn("flex h-16 items-center gap-6 px-6", minimal && "lg:px-16")}>
        <Brand />

        {/* Nothing else on an auth screen: an empty nav landmark is still a
            landmark a screen reader stops at, and the sign-in link would point
            at a page the visitor is one form away from anyway. */}
        {minimal ? null : (
          <>
            <nav className="flex items-center gap-2" aria-label="Primary navigation">
              {navItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    // Text alone, like SIGN IN beside it: no hover fill, no
                    // tinted pill on the active item. Weight carries the active
                    // state alongside the brand colour so it does not rest on
                    // hue alone, and `aria-current` states it outright — with
                    // the pill gone there is nothing else left to imply it.
                    // `rounded-md` stays: it shapes the focus ring, which is
                    // the one box here that still earns its place.
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition hover:text-brand",
                      isActive ? "font-semibold text-brand" : "font-medium text-muted-fg",
                    )}
                  >
                    <span className="material-symbols-rounded text-[18px]">{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-3">
              {isSignedIn && user ? (
                <ProfileMenu user={user} signOut={signOut} />
              ) : (
                // Signing up is the hero's "Join Now" now, so the bar carries sign-in
                // alone — in the slot sign-up used to hold.
                //
                // Set at the nav links' own `text-sm`, not smaller. This is the
                // only thing in the bar that is not navigation, and the caps and
                // tracking are what say so; size is the wrong axis for it, since
                // smaller reads as less important rather than as different.
                <Link
                  href={withBackLink("/sign-in", origin)}
                  className="rounded-lg px-5 py-2.5 text-sm font-semibold tracking-[0.04em] transition hover:text-brand"
                >
                  SIGN IN
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  );
}
