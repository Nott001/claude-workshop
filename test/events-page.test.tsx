// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { EventListPage } from "@/modules/events/pages/event-list";

vi.mock("@/modules/auth/components/session-context", () => ({ useSession: vi.fn() }));

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

import { useSession } from "@/modules/auth/components/session-context";

const events = [
  {
    id: 41,
    title: "Alpha",
    event_date: "2026-08-12",
    start_time: "09:00:00",
    end_time: "17:00:00",
    venue_name: "Hall A",
    venue_address: null,
    status: "active",
    cover_image_url: null,
    COURSE: null,
  },
  {
    id: 42,
    title: "Beta",
    event_date: "2026-08-20",
    start_time: "10:00:00",
    end_time: "18:00:00",
    venue_name: "Hall B",
    venue_address: null,
    status: "active",
    cover_image_url: null,
    COURSE: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  const useSessionMock = useSession as unknown as ReturnType<typeof vi.fn>;
  useSessionMock.mockReturnValue({
    user: { id: 1, role: ROLES.ATTENDEE, full_name: "Jane", email: "jane@example.com", profile_image_url: null },
    loading: false,
    isSignedIn: true,
    signOut: vi.fn(),
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: events, total: events.length, page: 1, limit: 50 }) }),
  );
});

afterEach(() => {
  // RTL's auto-cleanup keys off the global afterEach, which vitest does not
  // expose here (globals disabled). Without an explicit unmount the previous
  // test's tree stays in the document and every later query sees double.
  cleanup();
  vi.unstubAllGlobals();
});

describe("EventListPage event list", () => {
  it("links each card to /events/<id> using the API's id column", async () => {
    render(<EventListPage />);

    const links = await screen.findAllByRole("link");
    const hrefs = links.map((link) => link.getAttribute("href"));

    expect(hrefs).toContain("/events/41");
    expect(hrefs).toContain("/events/42");
  });
});

describe("EventListPage for a signed-in non-attendee", () => {
  it.each([
    [ROLES.SPEAKER, "/speaker/events"],
    [ROLES.FACILITATOR, "/staff/events/assigned"],
    [ROLES.ADMIN, "/staff/events"],
  ])("sends %s to %s instead of the staff list", async (role, dest) => {
    const useSessionMock = useSession as unknown as ReturnType<typeof vi.fn>;
    useSessionMock.mockReturnValue({
      user: { id: 1, role, full_name: "Sam", email: "sam@example.com", profile_image_url: null },
      loading: false,
      isSignedIn: true,
      signOut: vi.fn(),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [], total: 0, page: 1, limit: 50 }) }),
    );

    render(<EventListPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith(dest));
  });
});

describe("EventListPage for a signed-out visitor", () => {
  it("renders the published events served by the public API", async () => {
    const useSessionMock = useSession as unknown as ReturnType<typeof vi.fn>;
    useSessionMock.mockReturnValue({
      user: null,
      loading: false,
      isSignedIn: false,
      signOut: vi.fn(),
    });

    render(<EventListPage />);

    expect(await screen.findByText("Alpha")).toBeTruthy();
    expect(screen.getByText("Beta")).toBeTruthy();
  });

  it("shows the failure message when the API rejects the anonymous call", async () => {
    const useSessionMock = useSession as unknown as ReturnType<typeof vi.fn>;
    useSessionMock.mockReturnValue({
      user: null,
      loading: false,
      isSignedIn: false,
      signOut: vi.fn(),
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    render(<EventListPage />);

    expect(await screen.findByText("Failed to load events")).toBeTruthy();
  });
});

describe("events page loading state", () => {
  it("reserves the list's height instead of collapsing to a one-line message", async () => {
    // The app shell renders the footer with `mt-auto`. A short loading state
    // parks it inside the viewport, and the arriving list then shoves it down —
    // 0.141 of the 0.142 CLS Lighthouse measured on this page.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );

    render(<EventListPage />);

    expect(screen.getByLabelText("Loading events")).toBeTruthy();
    expect(screen.queryByText("Loading events...")).toBeNull();
  });

  it("shows enough placeholders to push the footer past the fold", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );

    const { container } = render(<EventListPage />);

    // Six cards at the real card height clears any realistic viewport.
    expect(container.querySelectorAll(".h-48").length).toBe(6);
  });
});
