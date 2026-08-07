// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/shared/db/client", () => ({ supabase: {} }));

const { getUpcomingForLanding } = vi.hoisted(() => ({ getUpcomingForLanding: vi.fn() }));
vi.mock("@/shared/db/dao/event.dao", () => ({ getUpcomingForLanding }));

vi.mock("@/modules/auth/components/post-login-redirect", () => ({
  PostLoginRedirect: () => null,
}));

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }));
vi.mock("@/modules/auth/components/session-context", () => ({ useSession }));

import LandingPage from "@/app/page";
import AttendeeHomePage from "@/app/home/page";

const apiRows = [
  {
    id: 41,
    title: "Alpha",
    event_date: "2026-08-12",
    start_time: "09:00:00",
    end_time: "17:00:00",
    venue_name: "Hall A",
    status: "active",
    cover_image_url: null,
    COURSE: { course_name: "AI for Business" },
  },
  {
    id: 42,
    title: "Beta",
    event_date: "2026-08-20",
    start_time: "10:00:00",
    end_time: "18:00:00",
    venue_name: "Hall B",
    status: "active",
    cover_image_url: null,
    COURSE: null,
  },
];

const attendee = {
  id: 1,
  role: "attendee",
  full_name: "Jane Doe",
  email: "jane@example.com",
  profile_image_url: null,
};

function signInAsAttendee() {
  useSession.mockReturnValue({
    user: attendee,
    loading: false,
    isLoaded: true,
    isSignedIn: true,
    signOut: vi.fn(),
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => apiRows }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("landing page (logged out) event cards", () => {
  it("renders published events as linkable EventCards", async () => {
    getUpcomingForLanding.mockResolvedValue(apiRows);

    render(await LandingPage());

    const links = await screen.findAllByRole("link");

    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/events/41", "/events/42"]);
  });

  it("shows the empty state when no events are published", async () => {
    getUpcomingForLanding.mockResolvedValue([]);

    render(await LandingPage());

    expect(screen.getByText("No upcoming events.")).toBeTruthy();
  });
});

describe("attendee home page event grid", () => {
  it("renders upcoming events as linkable cards", async () => {
    signInAsAttendee();

    render(<AttendeeHomePage />);

    expect(await screen.findByRole("link", { name: /Alpha/ })).toBeTruthy();
  });

  it("wraps the grid in a full-width container with page padding", async () => {
    signInAsAttendee();

    render(<AttendeeHomePage />);

    const link = await screen.findByRole("link", { name: /Alpha/ });
    const grid = link.closest(".grid");
    const wrapper = grid?.parentElement;

    expect(grid?.className).toContain("gap-4");
    expect(wrapper?.className).toContain("px-6");
    expect(wrapper?.className).toContain("py-12");
    expect(wrapper?.className).not.toContain("max-w");
  });
});
