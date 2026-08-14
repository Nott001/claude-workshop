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

  it("filters by status via the tab", async () => {
    fetchMock = stubFetch([], 0);
    vi.stubGlobal("fetch", fetchMock);

    render(<AttendeesPanel eventId="7" />);
    await screen.findByText("No attendees found");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Checked in" }));
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
