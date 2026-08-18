// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/shared/db/client", () => ({ supabase: {} }));

const { getUpcomingForLanding } = vi.hoisted(() => ({ getUpcomingForLanding: vi.fn() }));
vi.mock("@/modules/events/db/event.dao", () => ({ getUpcomingForLanding }));

vi.mock("@/modules/auth/components/post-login-redirect", () => ({
  PostLoginRedirect: () => null,
}));

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }));
vi.mock("@/modules/auth/components/session-context", () => ({ useSession }));

import LandingPage from "@/app/page";

const apiRows = [
  {
    id: 41,
    title: "Alpha",
    event_date: "2026-08-12",
    start_time: "09:00:00",
    end_time: "17:00:00",
    venue_name: "Hall A",
    status: "active",
    event_type: "onsite",
    cover_image_url: null,
    COURSE: { course_name: "AI for Business" },
  },
  {
    id: 42,
    title: "Beta",
    event_date: "2026-08-20",
    start_time: "10:00:00",
    end_time: "18:00:00",
    venue_name: "Zoom",
    status: "active",
    event_type: "online",
    cover_image_url: null,
    COURSE: null,
  },
  {
    id: 43,
    title: "Gamma",
    event_date: "2026-08-28",
    start_time: "13:00:00",
    end_time: "16:00:00",
    venue_name: "Hall C",
    status: "active",
    cover_image_url: null,
    COURSE: null,
  },
];

const attendee = {
  id: 1,
  role: ROLES.ATTENDEE,
  full_name: "Jane Doe",
  email: "jane@example.com",
  profile_image_url: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("landing page (logged out) event cards", () => {
  it("shows guests the tagline and the Join Now CTA", async () => {
    getUpcomingForLanding.mockResolvedValue(apiRows);
    useSession.mockReturnValue({
      user: null,
      loading: false,
      isLoaded: true,
      isSignedIn: false,
      signOut: vi.fn(),
    });

    render(await LandingPage());

    expect(screen.getByText(/learn\. connect\. grow\./i)).toBeTruthy();
    expect(screen.getByText("Upcoming Events")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Join Now" }).getAttribute("href")).toBe("/sign-up");
  });

  it("shows the empty state when no events are published", async () => {
    getUpcomingForLanding.mockResolvedValue([]);
    useSession.mockReturnValue({
      user: null,
      loading: false,
      isLoaded: true,
      isSignedIn: false,
      signOut: vi.fn(),
    });

    render(await LandingPage());

    expect(screen.getByText("No upcoming events.")).toBeTruthy();
  });
});

describe("merged landing page for a signed-in attendee", () => {
  it("greets by name and still lists upcoming events tagged for the landing page", async () => {
    getUpcomingForLanding.mockResolvedValue(apiRows);
    useSession.mockReturnValue({
      user: attendee,
      loading: false,
      isLoaded: true,
      isSignedIn: true,
      signOut: vi.fn(),
    });

    render(await LandingPage());

    expect(screen.getByText("Welcome, Jane!")).toBeTruthy();
    expect(screen.getByText(/learn\. connect\. grow\./i)).toBeTruthy();
    expect(screen.getByText("Upcoming Events")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Join Now" })).toBeNull();

    const cardHrefs = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"))
      .filter((href) => href?.startsWith("/events/"));
    expect(cardHrefs).toEqual(["/events/41?from=landing", "/events/42?from=landing", "/events/43?from=landing"]);
  });
});

describe("landing card venue row", () => {
  beforeEach(() => {
    useSession.mockReturnValue({
      user: null,
      loading: false,
      isLoaded: true,
      isSignedIn: false,
      signOut: vi.fn(),
    });
  });

  it("marks an online event with the camera icon and an onsite one with the pin", async () => {
    getUpcomingForLanding.mockResolvedValue(apiRows);

    render(await LandingPage());

    // The icon is the ligature text of the span, so the rendered glyph name is
    // what distinguishes the two modes on the card.
    expect(screen.getByText("Hall A").closest("p")?.textContent).toContain("location_on");
    expect(screen.getByText("Zoom").closest("p")?.textContent).toContain("videocam");
  });

  it("falls back to onsite for a row written before the mode column existed", async () => {
    getUpcomingForLanding.mockResolvedValue(apiRows);

    render(await LandingPage());

    expect(screen.getByText("Hall C").closest("p")?.textContent).toContain("location_on");
  });
});
