// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent, act } from "@testing-library/react";
import { AttendeesPanel } from "@/modules/kiosk/components/attendees-panel";

vi.mock("@/shared/integrations/realtime", () => ({
  subscribeToCheckins: vi.fn(() => ({ unsubscribe: vi.fn() })),
  unsubscribe: vi.fn(),
}));

const attendee = {
  user_id: 1,
  full_name: "Rina Dela Cruz",
  email: "rina@example.com",
  ticket_status: "issued" as const,
  issued_at: "2026-08-01T09:00:00.000Z",
  checked_in_at: null,
};

const checkedInAttendee = {
  ...attendee,
  user_id: 2,
  full_name: "Jose Santos",
  email: "jose@example.com",
  ticket_status: "checked_in" as const,
  checked_in_at: "2026-08-14T10:00:00.000Z",
};

const cancelledAttendee = {
  ...attendee,
  user_id: 3,
  full_name: "Carol Cruz",
  email: "carol@example.com",
  ticket_status: "cancelled" as const,
  checked_in_at: null,
};

function stubFetch(attendees: unknown[], total: number) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => ({ attendees, total }) });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("AttendeesPanel", () => {
  it("shows the cancelled badge for a cancelled attendee", async () => {
    fetchMock = stubFetch([cancelledAttendee], 1);
    vi.stubGlobal("fetch", fetchMock);

    render(<AttendeesPanel eventId="7" />);

    expect(await screen.findByText("Cancelled")).toBeTruthy();
  });

  it("renders rows from the stubbed attendees fetch", async () => {
    fetchMock = stubFetch([attendee, checkedInAttendee], 2);
    vi.stubGlobal("fetch", fetchMock);

    render(<AttendeesPanel eventId="7" />);

    expect(await screen.findByText("Rina Dela Cruz")).toBeTruthy();
    expect(screen.getByText("jose@example.com")).toBeTruthy();
    expect(screen.getByText("Registered")).toBeTruthy();
    expect(screen.getAllByText("Checked in").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/\d{1,2}:\d{2} (AM|PM)/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/events/7/attendees?page=1&limit=15");
  });

  it("types in search, fires a fetch with search= after the debounce and resets the page", async () => {
    vi.useFakeTimers();
    const urls: string[] = [];
    fetchMock = vi.fn(async (url: string) => {
      urls.push(String(url));
      return { ok: true, json: async () => ({ attendees: [], total: 0 }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AttendeesPanel eventId="7" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(urls[urls.length - 1]).toBe("/api/events/7/attendees?page=1&limit=15");

    fireEvent.change(screen.getByPlaceholderText("Search name or email..."), {
      target: { value: "rina" },
    });

    expect(urls).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(urls[urls.length - 1]).toBe("/api/events/7/attendees?page=1&limit=15&search=rina");
  });

  it("shows the empty state under the column headers when nothing matches", async () => {
    fetchMock = stubFetch([], 0);
    vi.stubGlobal("fetch", fetchMock);

    render(<AttendeesPanel eventId="7" />);

    expect(await screen.findByText("No attendees found")).toBeTruthy();
    expect(screen.getByText("Checked In")).toBeTruthy();
    expect(screen.getByText("Status")).toBeTruthy();
  });

  it("keeps the rows and shows the unified notice when a refetch fails", async () => {
    vi.useFakeTimers();
    fetchMock = stubFetch([attendee], 1);
    vi.stubGlobal("fetch", fetchMock);

    render(<AttendeesPanel eventId="7" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("Rina Dela Cruz")).toBeTruthy();

    fetchMock.mockImplementation(() => Promise.resolve({ ok: false, json: async () => ({}) }));

    fireEvent.change(screen.getByPlaceholderText("Search name or email..."), { target: { value: "rina" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(screen.getByText("Failed to refresh attendees — showing last loaded results.")).toBeTruthy();
    expect(screen.getByText("Rina Dela Cruz")).toBeTruthy();
    expect(screen.getByText("Checked In")).toBeTruthy();
  });

  it("dims the rows and sets aria-busy while a search refetch is in flight", async () => {
    vi.useFakeTimers();
    let lastResolve: ((value: unknown) => void) | undefined;
    fetchMock = vi.fn(() => new Promise((resolve) => (lastResolve = resolve)));
    vi.stubGlobal("fetch", fetchMock);

    render(<AttendeesPanel eventId="7" />);
    await act(async () => {
      lastResolve?.({ ok: true, json: async () => ({ attendees: [attendee], total: 1 }) });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("Rina Dela Cruz")).toBeTruthy();
    expect(document.querySelector("tbody")?.getAttribute("aria-busy")).toBeNull();

    fireEvent.change(screen.getByPlaceholderText("Search name or email..."), { target: { value: "rina" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(document.querySelector("tbody")?.getAttribute("aria-busy")).toBe("true");

    await act(async () => {
      lastResolve?.({ ok: true, json: async () => ({ attendees: [attendee], total: 1 }) });
    });
    expect(document.querySelector("tbody")?.getAttribute("aria-busy")).toBeNull();
  });

  it("filters by status via the select", async () => {
    fetchMock = stubFetch([], 0);
    vi.stubGlobal("fetch", fetchMock);

    render(<AttendeesPanel eventId="7" />);
    await screen.findByText("No attendees found");

    await act(async () => {
      fireEvent.click(screen.getByRole("combobox"));
      const checkedInOption = await screen.findByRole("option", { name: "Checked in" });
      fireEvent.pointerDown(checkedInOption, { pointerType: "mouse" });
      fireEvent.click(checkedInOption);
    });

    expect(fetchMock).toHaveBeenLastCalledWith("/api/events/7/attendees?page=1&limit=15&status=checked_in");
  });

  it("opens the drawer on row click with the attendee's details", async () => {
    fetchMock = stubFetch([attendee], 1);
    vi.stubGlobal("fetch", fetchMock);

    render(<AttendeesPanel eventId="7" />);
    await screen.findByText("Rina Dela Cruz");

    fireEvent.click(screen.getByRole("row", { name: /View Rina Dela Cruz/ }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toContain("rina@example.com");
    expect(dialog.textContent).toMatch(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4}/);
    expect(screen.queryByRole("button", { name: "Check in" })).toBeNull();
  });

  it("paginates with page=2", async () => {
    fetchMock = stubFetch([attendee], 30);
    vi.stubGlobal("fetch", fetchMock);

    render(<AttendeesPanel eventId="7" />);
    await screen.findByText("Rina Dela Cruz");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/events/7/attendees?page=2&limit=15"));
  });
});
