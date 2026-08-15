// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }));
vi.mock("@/modules/auth/components/session-context", () => ({ useSession }));

// `next/link` consumes `prefetch` instead of forwarding it to the anchor, so
// the prop is invisible in the rendered DOM. Standing in for the component is
// the only way to observe what the rail actually asks for.
vi.mock("next/link", () => ({
  default: ({
    href,
    prefetch,
    className,
    children,
  }: {
    href: string;
    prefetch?: boolean;
    className?: string;
    children: React.ReactNode;
  }) => (
    <a href={href} className={className} data-prefetch={String(prefetch)}>
      {children}
    </a>
  ),
}));

import { Navbar } from "@/modules/shell/components/navbar";

function renderAs(role: string | null) {
  useSession.mockReturnValue({
    user: role ? { id: 1, role, full_name: "Ada Lovelace", email: "ada@example.com", profile_image_url: null } : null,
    isSignedIn: role !== null,
    signOut: vi.fn(),
  });
  return render(<Navbar />);
}

function navLinks(): HTMLElement[] {
  return within(screen.getByRole("navigation", { name: "Primary navigation" })).getAllByRole("link");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => null }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * Every rail destination is a dynamic route, so Next's default `auto` prefetch
 * turns one page load into a server render per link. For an admin that is six
 * at once, and on the Workers Free plan the burst is what gets killed: a
 * 15-minute capture of production traffic caught 12 of 14 `exceededCpu`
 * invocations inside a single second, five of them these exact links.
 *
 * Prefetching only runs in production builds, so nothing in `next dev` or in a
 * browser test can catch a regression here — which is what this file is for.
 */
describe("Navbar prefetching", () => {
  it("does not prefetch any of the admin rail's six destinations", () => {
    renderAs(ROLES.ADMIN);
    const links = navLinks();
    expect(links).toHaveLength(6);
    for (const link of links) {
      expect(link.dataset.prefetch).toBe("false");
    }
  });

  it("does not prefetch the guest rail either", () => {
    renderAs(null);
    const links = navLinks();
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.dataset.prefetch).toBe("false");
    }
  });

  it("still points each item at its own destination", () => {
    renderAs(ROLES.ADMIN);
    expect(navLinks().map((a) => a.getAttribute("href"))).toEqual([
      "/staff/events",
      "/staff/organization",
      "/staff/community",
      "/staff/emails",
      "/staff/support",
      "/staff/audit-logs",
    ]);
  });
});
