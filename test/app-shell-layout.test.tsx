// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

const { useSession, usePathname, TopNavbar, StaffNavbar } = vi.hoisted(() => ({
  useSession: vi.fn(),
  usePathname: vi.fn(() => "/home"),
  TopNavbar: vi.fn(() => null),
  StaffNavbar: vi.fn(() => null),
}));
vi.mock("next/navigation", () => ({ usePathname }));
vi.mock("@/modules/auth/components/session-context", () => ({ useSession }));
vi.mock("@/modules/shell/components/top-navbar", () => ({ TopNavbar }));
vi.mock("@/modules/shell/components/staff-navbar", () => ({ StaffNavbar }));

import { AppShell } from "@/modules/shell/components/app-shell";

function renderShell(role: string | null) {
  useSession.mockReturnValue({
    user: role ? { id: 1, role, full_name: "Ada Lovelace", email: "ada@example.com", profile_image_url: null } : null,
    isSignedIn: role !== null,
    signOut: vi.fn(),
  });
  return render(
    <AppShell>
      <p>page content</p>
    </AppShell>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("AppShell navbar branch", () => {
  it("gives a guest the top navbar, not the staff navbar", () => {
    renderShell(null);
    expect(TopNavbar).toHaveBeenCalledTimes(1);
    expect(StaffNavbar).not.toHaveBeenCalled();
  });

  it("gives an attendee the top navbar", () => {
    renderShell(ROLES.ATTENDEE);
    expect(TopNavbar).toHaveBeenCalledTimes(1);
    expect(StaffNavbar).not.toHaveBeenCalled();
  });

  it("gives an admin the staff navbar, not the attendee top navbar", () => {
    renderShell(ROLES.ADMIN);
    expect(StaffNavbar).toHaveBeenCalledTimes(1);
    expect(TopNavbar).not.toHaveBeenCalled();
  });

  it("gives a speaker the staff navbar", () => {
    renderShell(ROLES.SPEAKER);
    expect(StaffNavbar).toHaveBeenCalledTimes(1);
    expect(TopNavbar).not.toHaveBeenCalled();
  });
});

describe("AppShell main column offset", () => {
  it("uses only pt-16 for the top-navbar-only case", () => {
    const { container } = renderShell(ROLES.ATTENDEE);
    const className = container.querySelector("main")?.className;
    expect(className).toContain("pt-16");
    expect(className).not.toContain("lg:pl-[72px]");
  });

  it("adds the collapsed rail offset for the staff-navbar case", () => {
    const { container } = renderShell(ROLES.ADMIN);
    const className = container.querySelector("main")?.className;
    expect(className).toContain("pt-16");
    expect(className).toContain("lg:pl-[72px]");
  });
});
