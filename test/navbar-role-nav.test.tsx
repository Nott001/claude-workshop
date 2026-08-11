// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

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
  return render(<Navbar />);
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
});

describe("Navbar collapsed rail", () => {
  it("collapses to an icon-only rail that expands on hover and keyboard focus", () => {
    const { container } = renderAs(ROLES.ADMIN);
    const aside = container.querySelector("aside");
    const className = aside?.className ?? "";
    expect(className).toContain("w-[72px]");
    expect(className).toContain("hover:w-[202px]");
    expect(className).toContain("has-[:focus-visible]:w-[202px]");
    expect(className).toContain("transition-[width]");
    // :focus-within would match a mouse-clicked link that keeps focus across
    // navigation and pin the rail open; only keyboard focus may expand it.
    expect(className).not.toContain("focus-within");
  });

  it("keeps the labels in the DOM, hidden while collapsed and revealed on hover or keyboard focus", () => {
    const { container } = renderAs(ROLES.ADMIN);
    const label = within(container.querySelector("aside") as HTMLElement).getByText("Create event");
    const className = label.className;
    expect(className).toContain("max-w-0");
    expect(className).toContain("opacity-0");
    expect(className).toContain("group-hover:max-w-[140px]");
    expect(className).toContain("group-hover:opacity-100");
    expect(className).toContain("group-has-[:focus-visible]:max-w-[140px]");
    expect(className).toContain("group-has-[:focus-visible]:opacity-100");
  });

  it("pins each icon in a fixed-width box instead of toggling justify so it cannot snap", () => {
    renderAs(ROLES.ADMIN);
    const nav = screen.getByRole("navigation", { name: "Primary navigation" });
    const links = within(nav).getAllByRole("link");
    for (const link of links) {
      expect(link.className).not.toContain("justify-center");
      expect(link.className).not.toContain("group-hover:justify-start");
      const iconBox = link.querySelector(".material-symbols-rounded")?.parentElement;
      expect(iconBox?.className).toContain("w-6");
    }
  });
});
