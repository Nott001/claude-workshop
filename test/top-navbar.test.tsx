// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import type { UserRole } from "@/shared/types";

const { useSession, usePathname } = vi.hoisted(() => ({
  useSession: vi.fn(),
  usePathname: vi.fn(() => "/"),
}));
vi.mock("next/navigation", () => ({ usePathname }));
vi.mock("@/modules/auth/components/session-context", () => ({ useSession }));

import { TopNavbar } from "@/modules/shell/components/top-navbar";

function renderAs(role: string | null, pathname = "/") {
  usePathname.mockReturnValue(pathname);
  useSession.mockReturnValue({
    user: role ? { id: 1, role, full_name: "Ada Lovelace", email: "ada@example.com", profile_image_url: null } : null,
    isSignedIn: role !== null,
    signOut: vi.fn(),
  });
  render(<TopNavbar />);
}

/** The labels of the primary nav, in render order, with the icon glyph stripped. */
function navLabels(): string[] {
  const nav = screen.getByRole("navigation", { name: "Primary navigation" });
  return within(nav)
    .getAllByRole("link")
    .map((a) => {
      const icon = a.querySelector(".material-symbols-rounded")?.textContent ?? "";
      return (a.textContent ?? "").slice(icon.length).trim();
    });
}

function navLink(name: string) {
  return within(screen.getByRole("navigation", { name: "Primary navigation" })).getByRole("link", { name: RegExp(name) });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => null }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TopNavbar role nav items", () => {
  it("shows an attendee Home, Events, Community and Tickets — never /staff or /speaker links", () => {
    renderAs(ROLES.ATTENDEE);
    expect(navLabels()).toEqual(["Home", "Events", "Community", "Tickets"]);
    for (const a of within(screen.getByRole("navigation", { name: "Primary navigation" })).getAllByRole("link")) {
      expect(a.getAttribute("href")).not.toMatch(/^\/(staff|speaker)/);
    }
  });

  it("points the attendee Home item at the merged landing page", () => {
    renderAs(ROLES.ATTENDEE);
    expect(navLink("Home").getAttribute("href")).toBe("/");
  });

  it("falls back to the attendee set for an unrecognised role", () => {
    renderAs("wizard" as UserRole);
    expect(navLabels()).toEqual(["Home", "Events", "Community", "Tickets"]);
  });

  it("shows the profile menu for a signed-in attendee", () => {
    renderAs(ROLES.ATTENDEE);
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
  });

  it("marks the link matching the current pathname as active", () => {
    renderAs(ROLES.ATTENDEE, "/events");
    expect(navLink("Events").getAttribute("aria-current")).toBe("page");
    expect(navLink("Home").getAttribute("aria-current")).toBeNull();
  });

  // The active item used to be a brand-tinted pill. Now that it is text on the
  // bar's own background, colour is the only thing separating it from its
  // neighbours — so it carries weight too, and says so out loud above.
  it("distinguishes the active link by more than its colour", () => {
    renderAs(ROLES.ATTENDEE, "/events");

    expect(navLink("Events").className).toContain("font-semibold");
    expect(navLink("Home").className).toContain("font-medium");
  });

  it("gives the nav links no box of their own", () => {
    renderAs(ROLES.ATTENDEE, "/events");

    for (const label of ["Events", "Home"]) {
      const className = navLink(label).className;
      expect(className).not.toMatch(/(^|\s|:)bg-/);
      expect(className).not.toContain("border");
    }
  });
});

describe("TopNavbar guest view", () => {
  it("shows the signed-out nav for a guest", () => {
    renderAs(null);
    expect(navLabels()).toEqual(["Home", "Events", "Community"]);
  });

  it("points the guest Home item at /", () => {
    renderAs(null);
    expect(navLink("Home").getAttribute("href")).toBe("/");
  });

  it("shows SIGN IN alone, with no profile menu", () => {
    renderAs(null);
    const signIn = screen.getByRole("link", { name: "SIGN IN" });

    // Tagged with the route the guest is on, so the auth screen can offer the
    // way back to it. This view renders at "/".
    expect(signIn.getAttribute("href")).toBe("/sign-in?from=landing");
    expect(signIn.className).not.toContain("border");
    expect(screen.queryByText("Ada Lovelace")).toBeNull();
  });

  // It sat at text-xs beside text-sm links, which read as a demotion rather
  // than as the distinction it wanted. The caps and tracking carry that now.
  it("sets SIGN IN at the same size as the nav links", () => {
    renderAs(null);

    const signIn = screen.getByRole("link", { name: "SIGN IN" });

    expect(signIn.className).toContain("text-sm");
    expect(signIn.className).not.toContain("text-xs");
    expect(signIn.className).toContain("tracking-[0.04em]");
    expect(navLink("Home").className).toContain("text-sm");
  });

  // Signing up moved to the landing hero's "Join Now"; a second bar button
  // would put two competing calls to action on the same screen. This assertion
  // has been deleted once already, and the button came back with it.
  it("no longer offers SIGN UP in the bar", () => {
    renderAs(null);
    expect(screen.queryByRole("link", { name: "SIGN UP" })).toBeNull();
    expect([...document.querySelectorAll('a[href^="/sign-up"]')]).toEqual([]);
  });
});

describe("TopNavbar auth buttons", () => {
  it.each([
    ["/events", "/sign-in?from=events"],
    ["/community/3", "/sign-in?from=community"],
    ["/", "/sign-in?from=landing"],
  ])("tells the auth screen a guest came from %s", (pathname, signIn) => {
    renderAs(null, pathname);

    expect(screen.getByRole("link", { name: "SIGN IN" }).getAttribute("href")).toBe(signIn);
  });

  it("leaves the link bare from a route with no way back to offer", () => {
    renderAs(null, "/staff/events");

    expect(screen.getByRole("link", { name: "SIGN IN" }).getAttribute("href")).toBe("/sign-in");
  });
});

describe("TopNavbar minimal", () => {
  function renderMinimal(role: string | null, pathname = "/sign-up") {
    usePathname.mockReturnValue(pathname);
    useSession.mockReturnValue({
      user: role ? { id: 1, role, full_name: "Ada Lovelace", email: "ada@example.com", profile_image_url: null } : null,
      isSignedIn: role !== null,
      signOut: vi.fn(),
    });
    return render(<TopNavbar minimal />);
  }

  it("carries the mark and nothing else", () => {
    renderMinimal(null);

    expect(screen.getByRole("link", { name: "StartupLab" })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Primary navigation" })).toBeNull();
    expect(screen.queryByRole("link", { name: "SIGN IN" })).toBeNull();
  });

  it("does not offer an account menu to a signed-in visitor either", () => {
    renderMinimal(ROLES.ATTENDEE);

    expect(screen.queryByRole("button", { name: /ada/i })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Primary navigation" })).toBeNull();
  });

  it("scrolls with the page instead of pinning over the form", () => {
    const { container } = renderMinimal(null);

    const header = container.querySelector("header");
    expect(header?.className).toContain("sticky");
    expect(header?.className).not.toContain("fixed");
  });

  it("still pins on an ordinary page", () => {
    usePathname.mockReturnValue("/");
    useSession.mockReturnValue({ user: null, isSignedIn: false, signOut: vi.fn() });

    const { container } = render(<TopNavbar />);

    expect(container.querySelector("header")?.className).toContain("fixed");
  });
});
