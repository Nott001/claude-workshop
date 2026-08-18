// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

const { useSession, usePathname } = vi.hoisted(() => ({
  useSession: vi.fn(),
  usePathname: vi.fn(() => "/staff/events"),
}));
vi.mock("next/navigation", () => ({ usePathname }));
vi.mock("@/modules/auth/components/session-context", () => ({ useSession }));

import { StaffNavbar } from "@/modules/shell/components/staff-navbar";

function renderStaff(role = "admin") {
  useSession.mockReturnValue({
    user: { id: 1, role, full_name: "Ada Lovelace", email: "ada@example.com", profile_image_url: null },
    isSignedIn: true,
    signOut: vi.fn(),
  });
  return render(<StaffNavbar />);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => null }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("StaffNavbar", () => {
  it("shows the brand and the account menu in the top bar", () => {
    renderStaff();
    expect(screen.getByAltText("StartupLab")).toBeTruthy();
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
  });

  it("renders the collapsible nav rail with the role's links", () => {
    renderStaff("admin");
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Events/ })).toBeTruthy();
  });

  it("wears the same frosted surface as the attendee bar", () => {
    const { container } = renderStaff();

    const header = container.querySelector("header");

    expect(header?.className).toContain("bg-surface/75");
    expect(header?.className).toContain("backdrop-blur-xl");
    expect(header?.className).toContain("fixed");
  });

  // The rail hangs off the bottom edge of the bar, so the two read the same
  // token. Sizing one without the other opens a gap down the left of the page.
  it("stands at the shared height, with the rail starting where it ends", () => {
    const { container } = renderStaff();

    expect(container.querySelector("header > div")?.className).toContain("h-navbar");
    expect(container.querySelector("header > div")?.className).not.toContain("h-16");
    expect(container.querySelector("aside")?.className).toContain("top-navbar");
    expect(container.querySelector("aside")?.className).not.toContain("top-16");
  });
});
