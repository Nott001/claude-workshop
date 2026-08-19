// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, act, fireEvent } from "@testing-library/react";
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

describe("events page search", () => {
  it("sends the term to the API after the debounce, not on every keystroke", async () => {
    vi.useFakeTimers();
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(String(url));
        return { ok: true, json: async () => ({ data: events, total: events.length, page: 1, limit: 50 }) };
      }),
    );

    render(<EventListPage />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(urls[urls.length - 1]).toBe("/api/events?page=1&limit=50&filter=upcoming&status=active");

    fireEvent.change(screen.getByRole("textbox", { name: "Search events" }), { target: { value: "summit" } });
    expect(urls).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(urls[urls.length - 1]).toBe("/api/events?page=1&limit=50&filter=upcoming&status=active&search=summit");

    vi.useRealTimers();
  });

  // The whole page used to be replaced by the skeleton while a fetch was in
  // flight. With a search box on it that meant the input unmounting on the
  // pause after each keystroke, taking the cursor and the caret position out
  // of it — search would have been unusable.
  it("keeps the search box and tabs mounted while the refetch is in flight", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );

    render(<EventListPage />);

    expect(screen.getByLabelText("Loading events")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Search events" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Upcoming/ })).toBeTruthy();
  });

  it("says which tab came up empty and what was searched for", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ data: [], total: 0, page: 1, limit: 50 }) })),
    );

    render(<EventListPage />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText("No events found.")).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox", { name: "Search events" }), { target: { value: "nothing" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(screen.getByText("No upcoming events match “nothing”.")).toBeTruthy();

    vi.useRealTimers();
  });
});

describe("events page tabs", () => {
  it("marks the selected tab for assistive technology, not by weight alone", async () => {
    render(<EventListPage />);
    await waitFor(() => expect(screen.getByRole("tab", { name: /Upcoming/ })).toBeTruthy());

    const upcoming = screen.getByRole("tab", { name: /Upcoming/ });
    const completed = screen.getByRole("tab", { name: /Completed/ });

    expect(upcoming.getAttribute("aria-selected")).toBe("true");
    expect(completed.getAttribute("aria-selected")).toBe("false");
  });

  // `text-foreground`, `text-muted-foreground` and `bg-surface-hover` are not
  // tokens in this theme, so Tailwind emitted no rule for them and the two tabs
  // rendered the same colour on the same transparent background — the selected
  // one was distinguishable only by font weight.
  it("distinguishes the selected tab with classes the theme actually defines", async () => {
    render(<EventListPage />);
    await waitFor(() => expect(screen.getByRole("tab", { name: /Upcoming/ })).toBeTruthy());

    const upcoming = screen.getByRole("tab", { name: /Upcoming/ });
    const completed = screen.getByRole("tab", { name: /Completed/ });

    expect(upcoming.className).toContain("bg-muted");
    expect(upcoming.className).toContain("text-fg");
    expect(completed.className).toContain("text-muted-fg");
    for (const tab of [upcoming, completed]) {
      expect(tab.className).not.toContain("surface-hover");
      expect(tab.className).not.toContain("foreground");
    }
  });

  // The tabs were a client-side filter over one unscoped page of fifty, so a
  // tab could only ever show the events of its kind that happened to fall in
  // those fifty rows. Fifty upcoming events on the books and Completed rendered
  // empty with the whole archive sitting behind it.
  it("asks the server for each tab's own set rather than filtering one page", async () => {
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes("filter=past")
          ? { data: [{ ...events[0], id: 99, title: "Archived summit", status: "complete" }], total: 1, page: 1, limit: 50 }
          : { data: [], total: 0, page: 1, limit: 50 },
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<EventListPage />);
    await waitFor(() => expect(screen.getByRole("tab", { name: /Completed/ })).toBeTruthy());

    fireEvent.click(screen.getByRole("tab", { name: /Completed/ }));

    await waitFor(() => expect(screen.getByText("Archived summit")).toBeTruthy());
    // Drafts are staff-only and have a tab of their own, so the archive asks
    // for the two statuses that can legitimately read as finished.
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("filter=past"))).toBe(true);
  });

  it("counts the whole of the open tab, not the page that happens to be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ data: [events[0]], total: 137, page: 1, limit: 50 }),
      })),
    );

    render(<EventListPage />);
    await waitFor(() => expect(screen.getByRole("tab", { name: /Upcoming/ }).textContent).toBe("Upcoming (137)"));

    // The closed tab is a query nobody has run, so it carries no number rather
    // than a stale or invented one.
    expect(screen.getByRole("tab", { name: /Completed/ }).textContent).toBe("Completed");
  });
});
