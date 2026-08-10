// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import type { UserRole } from "@/shared/types";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }));
vi.mock("@/modules/auth/components/session-context", () => ({ useSession }));

import { Navbar } from "@/modules/shell/components/navbar";

function renderAs(role: string | null) {
  useSession.mockReturnValue({
    user: role ? { id: 1, role, full_name: "Ada Lovelace", email: "ada@example.com", profile_image_url: null } : null,
    isSignedIn: role !== null,
    signOut: vi.fn(),
  });
  render(<Navbar />);
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => null }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// SPEC-01-A. The navbar is the only thing that stops a speaker or facilitator
// from walking into a page they cannot use; the page guards (SPEC-01-B/C) are
// the second line, not the first.
describe("Navbar role nav items", () => {
  it("shows a speaker Dashboard and Community — no route into /staff", () => {
    renderAs(ROLES.SPEAKER);
    expect(navLabels()).toEqual(["Dashboard", "Community"]);
  });

  it("shows a facilitator My Events and Community", () => {
    renderAs(ROLES.FACILITATOR);
    expect(navLabels()).toEqual(["My Events", "Community"]);
  });

  it("points the facilitator My Events item at the assigned list, not the general listing", () => {
    renderAs(ROLES.FACILITATOR);
    const link = within(screen.getByRole("navigation", { name: "Primary navigation" })).getByRole("link", {
      name: /My Events/,
    });
    expect(link.getAttribute("href")).toBe("/staff/events/assigned");
  });

  it("shows an admin the full staff set, with Community pointing at management", () => {
    renderAs(ROLES.ADMIN);
    expect(navLabels()).toEqual([
      "Events",
      "Create event",
      "Courses",
      "Organization",
      "Community",
      "Emails",
      "Support",
      "Audit Logs",
    ]);
  });

  it("shows a super_admin the same set as an admin", () => {
    renderAs(ROLES.SUPER_ADMIN);
    const superAdmin = navLabels();
    cleanup();
    renderAs(ROLES.ADMIN);
    expect(superAdmin).toEqual(navLabels());
  });

  it("leaves the attendee nav with Community added", () => {
    renderAs(ROLES.ATTENDEE);
    expect(navLabels()).toEqual(["Home", "Events", "Community", "Tickets"]);
  });

  it("shows guests the signed-out nav including Community", () => {
    renderAs(null);
    expect(navLabels()).toEqual(["Home", "Events", "Community"]);
  });
});

describe("Navbar fallback for an unrecognised role", () => {
  // The fallback used to be `facilitator` — the worst possible default for a
  // role the map does not know. A corrupt or newly-added role handed out the
  // staff nav.
  it("falls back to attendee, not facilitator", () => {
    renderAs("wizard" as UserRole);
    expect(navLabels()).toEqual(["Home", "Events", "Community", "Tickets"]);
    expect(navLabels()).not.toContain("Create event");
  });
});
