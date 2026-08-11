// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import type { UserRole } from "@/shared/types";
import { ROLES } from "@/shared/lib/roles";

const replace = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useParams: () => ({ id: "7" }),
}));
vi.mock("@/modules/auth/components/session-context", () => ({ useSession: vi.fn() }));
vi.mock("@/modules/events/lib/use-event-detail", () => ({ useEventDetail: vi.fn() }));

import { useSession } from "@/modules/auth/components/session-context";
import { useEventDetail } from "@/modules/events/lib/use-event-detail";
import { EventDetailPage } from "@/modules/events/pages/event-detail";
import type { EventSpeakerProfile, EventWithCourse } from "@/modules/events/lib/types";

const baseEvent: EventWithCourse = {
  id: 7,
  title: "Launch Day",
  event_date: "2026-09-01",
  start_time: "09:00",
  end_time: "17:00",
  venue_name: "Main Hall",
  venue_address: null,
  course_id: null,
  cover_image_url: null,
  status: "active",
  price: 0,
  currency: "PHP",
  description: "All about the launch",
  survey_enabled: false,
  COURSE: null,
  EVENT_SPEAKER: [],
};

const speakerProfile: EventSpeakerProfile = {
  id: 1,
  user_id: 10,
  bio: "Jane has spent six years helping teams adopt practical AI tooling.",
  designation: "Lead AI Solutions Architect",
  linkedin_url: null,
  twitter_url: null,
  github_url: null,
  website_url: null,
  USER: { full_name: "Jane Smith", email: "jane@example.com", profile_image_url: "/jane.jpg" },
};

const scheduleModule = {
  id: 1,
  module_name: "Introduction",
  start_time: "09:00",
  end_time: "10:00",
  speaker: "John Doe",
};

function renderDetail(role: UserRole, overrides: Partial<ReturnType<typeof useEventDetail>> = {}) {
  (useSession as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ user: { id: 1, role } });
  (useEventDetail as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    event: baseEvent,
    loading: false,
    error: null,
    badgeProps: null,
    hasTicket: false,
    isSignedIn: true,
    handleRegister: vi.fn(),
    ...overrides,
  });
  return render(<EventDetailPage />);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ modules: [] }) })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("Event detail page assembly", () => {
  it("composes the hero, about, schedule, speakers, register, map and share sections for an attendee", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ modules: [scheduleModule] }),
    });
    renderDetail(ROLES.ATTENDEE, {
      event: { ...baseEvent, EVENT_SPEAKER: [{ SPEAKER_PROFILE: speakerProfile }] },
    });

    expect(screen.getByRole("heading", { level: 1, name: "Launch Day" })).toBeTruthy();
    expect(screen.getByText("active")).toBeTruthy();

    expect(screen.getByText("About this event")).toBeTruthy();
    expect(screen.getByText("All about the launch")).toBeTruthy();

    expect(await screen.findByText("Introduction")).toBeTruthy();

    expect(screen.getByText("Speakers")).toBeTruthy();
    expect(screen.getAllByText("Jane Smith").length).toBeGreaterThan(0);
    expect(screen.getByText("Lead AI Solutions Architect")).toBeTruthy();

    expect(screen.getByRole("button", { name: "Register" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /view in google maps/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /share on facebook/i })).toBeTruthy();
  });

  it("shows Enter Room instead of Register for a ticket holder with a linked course", () => {
    renderDetail(ROLES.ATTENDEE, {
      hasTicket: true,
      event: { ...baseEvent, COURSE: { id: 7, course_name: "Course", course_description: null } },
    });

    expect(screen.getByRole("button", { name: /enter room/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Register" })).toBeNull();
  });

  it("omits the about card and speaker section when the data is missing", async () => {
    renderDetail(ROLES.ATTENDEE, { event: { ...baseEvent, description: null } });

    expect(screen.queryByText("About this event")).toBeNull();
    expect(screen.queryByText("Speakers")).toBeNull();

    expect(await screen.findByText("Event schedule")).toBeTruthy();
  });

  it("redirects a non-attendee to the staff event page", async () => {
    renderDetail(ROLES.ADMIN);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/staff/events/7"));
  });

  it("renders the loading state while the event loads", () => {
    renderDetail(ROLES.ATTENDEE, { loading: true, event: null });

    expect(screen.getByText("Loading event...")).toBeTruthy();
  });

  it("renders the error state when the event fails to load", () => {
    renderDetail(ROLES.ATTENDEE, { loading: false, event: null, error: "Event not found" });

    expect(screen.getByText("Event not found")).toBeTruthy();
  });
});
