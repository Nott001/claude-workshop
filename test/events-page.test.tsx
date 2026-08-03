// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import EventsPage from "@/app/events/page";

vi.mock("@/modules/auth", () => ({ useSession: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

import { useSession } from "@/modules/auth";

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
    user: { id: 1, role: "attendee", full_name: "Jane", email: "jane@example.com", profile_image_url: null },
    loading: false,
    isSignedIn: true,
    signOut: vi.fn(),
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => events }));
});

afterEach(() => {
  // RTL's auto-cleanup keys off the global afterEach, which vitest does not
  // expose here (globals disabled). Without an explicit unmount the previous
  // test's tree stays in the document and every later query sees double.
  cleanup();
  vi.unstubAllGlobals();
});

describe("EventsPage event list", () => {
  it("links each card to /events/<id> using the API's id column", async () => {
    render(<EventsPage />);

    const links = await screen.findAllByRole("link");
    const hrefs = links.map((link) => link.getAttribute("href"));

    expect(hrefs).toContain("/events/41");
    expect(hrefs).toContain("/events/42");
  });
});

describe("EventsPage for a signed-out visitor", () => {
  it("renders the published events served by the public API", async () => {
    const useSessionMock = useSession as unknown as ReturnType<typeof vi.fn>;
    useSessionMock.mockReturnValue({
      user: null,
      loading: false,
      isSignedIn: false,
      signOut: vi.fn(),
    });

    render(<EventsPage />);

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

    render(<EventsPage />);

    expect(await screen.findByText("Failed to load events")).toBeTruthy();
  });
});
