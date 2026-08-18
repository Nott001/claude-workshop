"use client";

import { ROLES } from "@/shared/lib/roles";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/modules/auth/components/session-context";
import { cn } from "@/shared/lib/utils";
import type { UserRole } from "@/shared/types";
import { getNavItems } from "@/modules/shell/lib/nav-items";
import { NAV_BAR_SURFACE } from "@/modules/shell/lib/nav-surface";
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
    // Frosted rather than solid: the bar sits over content that scrolls beneath
    // it, and letting that read through is what tells you the page moved.
    <header className={cn(NAV_BAR_SURFACE, minimal ? "sticky" : "fixed")}>
      {/* Minimal keeps the mark over the content column it sits above, which is
          inset further than the app's own gutter. */}
      <div className={cn("h-navbar flex items-center gap-6 px-6", minimal && "lg:px-16")}>
        <Brand />

        {/* Nothing else on an auth screen: an empty nav landmark is still a
            landmark a screen reader stops at, and the sign-in link would point
            at a page the visitor is one form away from anyway. */}
        {minimal ? null : (
          <>
            <nav className="flex h-full items-stretch gap-2" aria-label="Primary navigation">
              {navItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    // Text alone, like SIGN IN beside it: no hover fill, no
                    // tinted pill. Idle links sit lighter than the foreground
                    // and hover jumps them to full `fg`, so the darkening is
                    // unmistakable; the selected entry stays blue on hover —
                    // blue means selected and nothing else on the bar does.
                    // The heavier weight and `aria-current` state it outright
                    // so it does not rest on colour alone. `rounded-md` stays:
                    // it shapes the focus ring, which is the one box here that
                    // still earns its place.
                    aria-current={isActive ? "page" : undefined}
                    // Same reason as the staff rail: these are dynamic routes,
                    // and the default prefetch renders every one of them on
                    // arrival. This bar is on every page a visitor or attendee
                    // sees, so it was the burst behind the killed `/events` and
                    // `/community` requests.
                    prefetch={false}
                    className={cn(
                      "relative flex items-center gap-2 rounded-md px-3 py-2 text-base transition",
                      "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand after:opacity-0",
                      isActive ? "font-semibold text-brand after:opacity-100" : "font-medium text-muted-fg/80 hover:text-fg",
                    )}
                  >
                    <span className="material-symbols-rounded text-[20px]">{item.icon}</span>
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
                // Held at `text-sm` while the nav links stepped up to `text-base`.
                // It was deliberately matched to them once, on the grounds that
                // size reads as rank; the caps and tracking now carry that
                // distinction on their own, and this is the one control in the
                // bar that is not navigation.
                <Link
                  href={withBackLink("/sign-in", origin)}
                  // The origin rides in the query string, so every page this bar
                  // renders on prefetches a *different* /sign-in URL — one more
                  // render per arrival, and one that shares no cache entry with
                  // the last. It was among the killed requests.
                  prefetch={false}
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
