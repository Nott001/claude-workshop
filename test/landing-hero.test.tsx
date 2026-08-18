// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }));
vi.mock("@/modules/auth/components/session-context", () => ({ useSession }));

import { LandingHero } from "@/modules/shell/components/landing-hero";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const attendee = { id: 1, role: "attendee", full_name: "Jane Doe", email: "jane@example.com", profile_image_url: null };

function renderHero(user: unknown) {
  useSession.mockReturnValue({
    user,
    loading: false,
    isLoaded: true,
    isSignedIn: !!user,
    signOut: vi.fn(),
    updateUser: vi.fn(),
  });
  render(<LandingHero />);
}

describe("LandingHero", () => {
  it("shows a guest the tagline, the landing headline and a Join Now call to action", () => {
    renderHero(null);

    expect(screen.getByText(/learn\. connect\. grow\./i)).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("StartupLab Business Center");
    const joinNow = screen.getByRole("link", { name: "Join Now" });
    expect(joinNow.getAttribute("href")).toBe("/sign-up");
    expect(screen.queryByText(/welcome/i)).toBeNull();
  });

  it("greets a signed-in attendee by first name and withholds the call to action", () => {
    renderHero(attendee);

    expect(screen.getByText(/learn\. connect\. grow\./i)).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Welcome, Jane!");
    expect(screen.queryByRole("link", { name: "Join Now" })).toBeNull();
  });

  it("falls back to a neutral greeting when the signed-in user has no full name", () => {
    renderHero({ id: 1, role: "attendee", full_name: null, email: "bo@example.com", profile_image_url: null });

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Welcome, there!");
    expect(screen.queryByRole("link", { name: "Join Now" })).toBeNull();
  });
});
