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
  event_date: "2099-01-01",
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

function renderDetail(role: UserRole, overrides: Partial<ReturnType<typeof useEventDetail>> = {}, from?: string) {
  (useSession as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ user: { id: 1, role } });
  (useEventDetail as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    event: baseEvent,
    loading: false,
    error: null,
    hasTicket: false,
    isSignedIn: true,
    handleRegister: vi.fn(),
    ...overrides,
  });
  return render(<EventDetailPage from={from} />);
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

// jsdom computes no grid geometry, so the invariant is asserted on the track
// list itself. `gap` is added to the tracks rather than taken out of them, so a
// pair of percentages summing to 100 overflows its container by exactly the
// gap — which hung the sticky column 24px past the hero's right edge. `fr`
// divides what remains after the gap, which is what this layout always meant.
describe("Event detail two-column track sizing", () => {
  it("sizes the content columns in fr so the gap cannot push the aside past the hero", () => {
    const { container } = renderDetail(ROLES.ATTENDEE);

    const grid = container.querySelector("aside")?.parentElement;
    const tracks = [...(grid?.classList ?? [])].find((c) => c.startsWith("lg:grid-cols-"));

    expect(tracks).toBe("lg:grid-cols-[65fr_35fr]");
    expect(tracks).not.toMatch(/%/);
  });
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
    expect(screen.getByText("Upcoming")).toBeTruthy();

    expect(screen.getByText("About this event")).toBeTruthy();
    expect(screen.getByText("All about the launch")).toBeTruthy();

    expect(await screen.findByText("Introduction")).toBeTruthy();

    expect(screen.getByText("Speakers")).toBeTruthy();
    expect(screen.getAllByText("Jane Smith").length).toBeGreaterThan(0);
    expect(screen.getByText("Lead AI Solutions Architect")).toBeTruthy();

    expect(screen.getByRole("button", { name: "Register" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /view larger map/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /share on facebook/i })).toBeTruthy();
  });

  it("offers a way back to the events list when nothing says where the reader came from", () => {
    renderDetail(ROLES.ATTENDEE);
    const back = screen.getByRole("link", { name: /back to events/i });

    expect(back.getAttribute("href")).toBe("/events");
  });

  it("sends the reader back to the page that linked here", () => {
    renderDetail(ROLES.ATTENDEE, {}, "community");
    const back = screen.getByRole("link", { name: /back to community/i });

    expect(back.getAttribute("href")).toBe("/community");
  });

  it("falls back to the events list for an unrecognised origin rather than following it", () => {
    renderDetail(ROLES.ATTENDEE, {}, "https://evil.example.com");
    const back = screen.getByRole("link", { name: /back to events/i });

    expect(back.getAttribute("href")).toBe("/events");
  });

  it("shows Enter Room instead of Register for a ticket holder with a linked course once the event has started", () => {
    renderDetail(ROLES.ATTENDEE, {
      hasTicket: true,
      event: {
        ...baseEvent,
        COURSE: { id: 7, course_name: "Course", course_description: null },
        event_date: "2020-01-01",
      },
    });

    expect(screen.getByRole("button", { name: /enter room/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Register" })).toBeNull();
  });

  it("locks a ticket holder's room button until the event starts", () => {
    renderDetail(ROLES.ATTENDEE, {
      hasTicket: true,
      event: { ...baseEvent, COURSE: { id: 7, course_name: "Course", course_description: null } },
    });

    expect((screen.getByRole("button", { name: /locked until start/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /enter room/i })).toBeNull();
  });

  it("keeps the register CTA off the hero, where the register card owns it", () => {
    renderDetail(ROLES.ATTENDEE);

    expect(screen.queryByRole("button", { name: /register now/i })).toBeNull();
    expect(screen.getByRole("button", { name: "Register" })).toBeTruthy();
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
