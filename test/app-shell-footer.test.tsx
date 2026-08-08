// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname }));

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }));
vi.mock("@/modules/auth/components/session-context", () => ({ useSession }));

vi.mock("@/shared/components/navbar", () => ({ Navbar: () => null }));
vi.mock("@/modules/support/components/floating-assist-button", () => ({
  FloatingAssistButton: () => null,
}));

import { AppShell } from "@/shared/components/app-shell";

afterEach(() => {
  cleanup();
});

function renderShell() {
  useSession.mockReturnValue({ user: null, isSignedIn: false, signOut: vi.fn() });
  return render(
    <AppShell>
      <p>page content</p>
    </AppShell>,
  );
}

describe("AppShell footer placement", () => {
  it("pins the footer to the bottom of the shell's main column", () => {
    vi.mocked(usePathname).mockReturnValue("/home");
    const { container } = renderShell();

    const footer = container.querySelector("footer");
    expect(footer).toBeTruthy();
    expect(footer?.className).toContain("mt-auto");
    expect(footer?.parentElement?.tagName.toLowerCase()).toBe("main");
    expect(screen.getByText(/StartupLab Business Center\. All rights reserved\./)).toBeTruthy();
  });

  it("omits the footer when the navbar is hidden (room pages)", () => {
    vi.mocked(usePathname).mockReturnValue("/courses/42/room");
    const { container } = renderShell();
    expect(container.querySelector("footer")).toBeNull();
  });
});
