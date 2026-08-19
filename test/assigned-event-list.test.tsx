// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react";
import { AssignedEventListPage } from "@/modules/events/pages/assigned-event-list";

vi.mock("@/modules/auth/components/session-context", () => ({ useSession: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

import { useSession } from "@/modules/auth/components/session-context";

const events = [
  {
    id: 1,
    title: "Alpha",
    event_date: "2026-08-12",
    start_time: "09:00:00",
    end_time: "17:00:00",
    venue_name: "Hall A",
    venue_address: null,
    status: "draft",
    cover_image_url: null,
    COURSE: null,
    attendee_count: 0,
  },
  {
    id: 2,
    title: "Beta",
    event_date: "2026-08-20",
    start_time: "10:00:00",
    end_time: "18:00:00",
    venue_name: "Hall B",
    venue_address: null,
    status: "active",
    cover_image_url: null,
    COURSE: null,
    attendee_count: 3,
  },
  {
    id: 3,
    title: "Gamma",
    event_date: "2026-07-01",
    start_time: "09:00:00",
    end_time: "17:00:00",
    venue_name: "Hall C",
    venue_address: null,
    status: "complete",
    cover_image_url: null,
    COURSE: null,
    attendee_count: 5,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  const useSessionMock = useSession as unknown as ReturnType<typeof vi.fn>;
  useSessionMock.mockReturnValue({
    user: { id: 1, role: ROLES.FACILITATOR, full_name: "Fay", email: "fay@example.com", profile_image_url: null },
    loading: false,
    isSignedIn: true,
    signOut: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("AssignedEventListPage", () => {
  // Each tab is its own server query, so which events a tab holds is settled by
  // the scope it asks for, not by a second filter over the answer. A stub that
  // returns every row regardless of the query tests only that second filter —
  // which is why this one answers the scope it was actually given.
  const scopedFetch = () => {
    const fetchMock = vi.fn(async (url: string) => {
      const params = new URL(String(url), "http://localhost").searchParams;
      const statuses = params.get("status")?.split(",") ?? [];
      const inWindow = (event: (typeof events)[number]) =>
        params.get("filter") === "past" ? event.status === "complete" : event.status !== "complete";
      const rows = events.filter((event) => statuses.includes(event.status) && inWindow(event));
      return { ok: true, json: async () => ({ data: rows, total: rows.length, page: 1, limit: 50 }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  };

  it("asks Upcoming for drafts alongside published events, and never for finished ones", async () => {
    const fetchMock = scopedFetch();

    render(<AssignedEventListPage />);

    expect(await screen.findByText("Alpha")).toBeTruthy();
    expect(screen.getByText("Beta")).toBeTruthy();
    expect(screen.queryByText("Gamma")).toBeNull();
    // A facilitator must see an unpublished event they have been assigned to
    // run, which is the whole of why this view opts into drafts.
    expect(String(fetchMock.mock.calls[0][0])).toContain("status=active%2Cdraft");
  });

  it("moves a finished event under Completed via the select", async () => {
    const fetchMock = scopedFetch();

    render(<AssignedEventListPage />);
    expect(await screen.findByText("Alpha")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("combobox"));
      const completedOption = await screen.findByRole("option", { name: "Completed" });
      fireEvent.pointerDown(completedOption, { pointerType: "mouse" });
      fireEvent.click(completedOption);
    });

    await waitFor(() => expect(screen.getByText("Gamma")).toBeTruthy());
    expect(screen.queryByText("Alpha")).toBeNull();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("filter=past"))).toBe(true);
  });

  it("loads the next page on Load More", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [events[0]], total: 60, page: 1, limit: 50 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [events[1]], total: 60, page: 2, limit: 50 }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<AssignedEventListPage />);
    expect(await screen.findByText("Alpha")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith("/api/events?page=2&limit=50&filter=upcoming&status=active%2Cdraft");
    expect(screen.getByText("Beta")).toBeTruthy();
  });

  it("renders a search input and drives the fetch server-side after the debounce", async () => {
    vi.useFakeTimers();
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(String(url));
        return { ok: true, json: async () => ({ data: events, total: 3, page: 1, limit: 50 }) };
      }),
    );

    render(<AssignedEventListPage />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(urls[urls.length - 1]).toBe("/api/events?page=1&limit=50&filter=upcoming&status=active%2Cdraft");

    fireEvent.change(screen.getByRole("textbox", { name: "Search events" }), {
      target: { value: "hall" },
    });

    expect(urls).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(urls[urls.length - 1]).toBe("/api/events?page=1&limit=50&filter=upcoming&status=active%2Cdraft&search=hall");
  });
});
