// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

const { useSession, usePathname, Navbar, TopNavbar } = vi.hoisted(() => ({
  useSession: vi.fn(),
  usePathname: vi.fn(() => "/home"),
  Navbar: vi.fn(() => null),
  TopNavbar: vi.fn(() => null),
}));
vi.mock("next/navigation", () => ({ usePathname }));
vi.mock("@/modules/auth/components/session-context", () => ({ useSession }));
vi.mock("@/modules/shell/components/navbar", () => ({ Navbar }));
vi.mock("@/modules/shell/components/top-navbar", () => ({ TopNavbar }));

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
  it("gives a guest the top navbar, not the sidebar", () => {
    renderShell(null);
    expect(TopNavbar).toHaveBeenCalledTimes(1);
    expect(Navbar).not.toHaveBeenCalled();
  });

  it("gives an attendee the top navbar", () => {
    renderShell(ROLES.ATTENDEE);
    expect(TopNavbar).toHaveBeenCalledTimes(1);
    expect(Navbar).not.toHaveBeenCalled();
  });

  it("keeps the sidebar for an admin", () => {
    renderShell(ROLES.ADMIN);
    expect(Navbar).toHaveBeenCalledTimes(1);
    expect(TopNavbar).not.toHaveBeenCalled();
  });

  it("keeps the sidebar for a speaker", () => {
    renderShell(ROLES.SPEAKER);
    expect(Navbar).toHaveBeenCalledTimes(1);
    expect(TopNavbar).not.toHaveBeenCalled();
  });
});

describe("AppShell main column offset", () => {
  it("uses pt-16 for the top navbar case", () => {
    const { container } = renderShell(ROLES.ATTENDEE);
    expect(container.querySelector("main")?.className).toContain("pt-16");
  });

  it("uses lg:pl-[202px] for the sidebar case", () => {
    const { container } = renderShell(ROLES.ADMIN);
    expect(container.querySelector("main")?.className).toContain("lg:pl-[202px]");
  });
});
