// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";

const { useRoleGuard, push } = vi.hoisted(() => ({ useRoleGuard: vi.fn(), push: vi.fn() }));

vi.mock("@/modules/auth/lib/use-role-guard", () => ({ useRoleGuard }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "7" }),
  useRouter: () => ({ push }),
}));
// The scanner owns a camera and a check-in round trip; neither belongs in a
// test about which event the page loaded.
vi.mock("@/modules/kiosk/components/kiosk-scanner-view", () => ({
  KioskScannerView: ({ event }: { event: { id: number } }) => <div data-testid="scanner">event {event.id}</div>,
}));

import StaffEventKioskPage from "@/app/staff/events/[id]/kiosk/page";

const EVENT = { id: 7, title: "Founder Bootcamp" };

function mockFetch(response: { ok: boolean; body?: unknown }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: response.ok,
    json: async () => response.body,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.clearAllMocks();
  useRoleGuard.mockReturnValue({ pending: false, allowed: true, role: "facilitator" });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("kiosk event lookup", () => {
  it("asks for the one event by id rather than scanning the upcoming list", async () => {
    const fetchMock = mockFetch({ ok: true, body: EVENT });

    render(<StaffEventKioskPage />);

    await waitFor(() => expect(screen.getByTestId("scanner")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/events/7");
  });

  it("still opens for an event whose end time has passed", async () => {
    // The old ?filter=upcoming lookup dropped exactly this event, stranding a
    // queue that had not finished checking in.
    mockFetch({ ok: true, body: { ...EVENT, event_date: "2020-01-01", end_time: "10:00" } });

    render(<StaffEventKioskPage />);

    await waitFor(() => expect(screen.getByTestId("scanner")).toBeTruthy());
  });

  it("says so when the event cannot be loaded", async () => {
    mockFetch({ ok: false });

    render(<StaffEventKioskPage />);

    await waitFor(() => expect(screen.getByText("Event not found or unavailable.")).toBeTruthy());
    expect(screen.queryByTestId("scanner")).toBeNull();
  });
});

describe("kiosk chrome", () => {
  it("carries its own bar and an exit back to the event", async () => {
    mockFetch({ ok: true, body: EVENT });

    render(<StaffEventKioskPage />);

    await waitFor(() => expect(screen.getByText("StartupLab — Kiosk mode")).toBeTruthy());
    expect(screen.getByText("Founder Bootcamp")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /EXIT KIOSK/ }));
    expect(push).toHaveBeenCalledWith("/staff/events/7");
  });

  it("locks to the viewport instead of scrolling as a page", async () => {
    mockFetch({ ok: true, body: EVENT });

    const { container } = render(<StaffEventKioskPage />);

    await waitFor(() => expect(screen.getByTestId("scanner")).toBeTruthy());
    expect(container.firstElementChild?.className).toContain("h-screen");
  });
});

describe("kiosk role guard", () => {
  it("fetches nothing while the session is still resolving", () => {
    useRoleGuard.mockReturnValue({ pending: true, allowed: false, role: null });
    const fetchMock = mockFetch({ ok: true, body: EVENT });

    render(<StaffEventKioskPage />);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText("StartupLab — Kiosk mode")).toBeNull();
  });

  it("renders nothing for a denied user rather than a spinner that never ends", () => {
    useRoleGuard.mockReturnValue({ pending: false, allowed: false, role: "attendee" });
    mockFetch({ ok: true, body: EVENT });

    const { container } = render(<StaffEventKioskPage />);

    expect(container.innerHTML).toBe("");
  });
});
