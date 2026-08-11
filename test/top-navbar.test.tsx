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

  it("points the attendee Home item at /home", () => {
    renderAs(ROLES.ATTENDEE);
    expect(navLink("Home").getAttribute("href")).toBe("/home");
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
    expect(navLink("Events").getAttribute("class")).toContain("bg-brand/10");
    expect(navLink("Home").getAttribute("class")).not.toContain("bg-brand/10");
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

  it("shows SIGN IN / SIGN UP linking to /sign-in and /sign-up, no profile menu", () => {
    renderAs(null);
    expect(screen.getByRole("link", { name: "SIGN IN" }).getAttribute("href")).toBe("/sign-in");
    expect(screen.getByRole("link", { name: "SIGN UP" }).getAttribute("href")).toBe("/sign-up");
    expect(screen.queryByText("Ada Lovelace")).toBeNull();
  });
});
