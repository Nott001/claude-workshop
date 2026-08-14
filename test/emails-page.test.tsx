// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act, waitFor } from "@testing-library/react";
import { ROLES } from "@/shared/lib/roles";
import StaffEmailsPage from "@/app/staff/emails/page";

vi.mock("@/modules/auth/lib/use-role-guard", () => ({ useRoleGuard: vi.fn() }));

import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";

const adaRow = {
  id: 21,
  user_id: 5,
  email_type: "ticket_issued",
  status: "sent",
  sent_at: "2026-08-01T10:00:00Z",
  created_at: "2026-08-01T10:00:00Z",
  updated_at: "2026-08-01T10:00:00Z",
  USER: { full_name: "Ada Admin", email: "ada@example.com" },
};

const benRow = {
  id: 22,
  user_id: 6,
  email_type: "event_survey",
  status: "failed",
  sent_at: null,
  created_at: "2026-08-02T10:00:00Z",
  updated_at: "2026-08-02T10:00:00Z",
  USER: { full_name: "Ben Member", email: "ben@example.com" },
};

let fetchMock: ReturnType<typeof vi.fn>;

function stubFetch(rows: unknown[], total: number) {
  fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ data: rows, total, page: 1, limit: 50 }) }));
  vi.stubGlobal("fetch", fetchMock);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useRoleGuard).mockReturnValue({ role: ROLES.ADMIN, allowed: true, pending: false });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("StaffEmailsPage", () => {
  it("renders rows with user, type, status and sent-at", async () => {
    stubFetch([adaRow, benRow], 2);

    render(<StaffEmailsPage />);

    expect(await screen.findByText("Ada Admin")).toBeTruthy();
    expect(screen.getByText("ada@example.com")).toBeTruthy();
    expect(screen.getByText("Ticket Issued")).toBeTruthy();
    expect(screen.getByText("Event Survey")).toBeTruthy();
    expect(screen.getByText("Failed")).toBeTruthy();
  });

  it("types search and fires search= after the debounce", async () => {
    vi.useFakeTimers();
    const urls: string[] = [];
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return { ok: true, json: async () => ({ data: [adaRow], total: 1, page: 1, limit: 50 }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<StaffEmailsPage />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(urls[urls.length - 1]).toBe("/api/logs?page=1&limit=50");

    fireEvent.change(screen.getByPlaceholderText("Search recipient name or email..."), {
      target: { value: "Ada" },
    });
    expect(urls).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(urls[urls.length - 1]).toBe("/api/logs?page=1&limit=50&search=Ada");
  });

  it("drives email_type and status params through the selects", async () => {
    stubFetch([adaRow], 1);

    render(<StaffEmailsPage />);
    await screen.findByText("Ada Admin");

    const [typeSelect] = screen.getAllByRole("combobox");
    fireEvent.click(typeSelect);
    const checkInOption = await screen.findByRole("option", { name: "Check-In Confirmed" });
    fireEvent.pointerDown(checkInOption, { pointerType: "mouse" });
    fireEvent.click(checkInOption);
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/logs?email_type=check_in_confirmed&page=1&limit=50"));

    const [, statusSelect] = screen.getAllByRole("combobox");
    fireEvent.click(statusSelect);
    const failedOption = await screen.findByRole("option", { name: "Failed" });
    fireEvent.pointerDown(failedOption, { pointerType: "mouse" });
    fireEvent.click(failedOption);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith("/api/logs?email_type=check_in_confirmed&status=failed&page=1&limit=50"),
    );
  });

  it("opens the drawer on row click showing the full record", async () => {
    stubFetch([adaRow], 1);

    render(<StaffEmailsPage />);
    await screen.findByText("Ada Admin");

    fireEvent.click(screen.getByRole("row", { name: "View Ticket Issued" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toContain("ada@example.com");
    expect(dialog.textContent).toContain("Ticket Issued");
    expect(dialog.textContent).toContain("Sent At");
    expect(dialog.textContent).toContain("Created At");
    expect(dialog.textContent).toContain("21");
  });

  it("keeps load-more appending after the first page", async () => {
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const page = new URLSearchParams(String(input).split("?")[1]).get("page") ?? "1";
      return {
        ok: true,
        json: async () => ({ data: page === "1" ? [adaRow] : [benRow], total: 60, page: Number(page), limit: 50 }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<StaffEmailsPage />);
    await screen.findByText("Ada Admin");
    expect(screen.queryByText("Ben Member")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));

    expect(await screen.findByText("Ben Member")).toBeTruthy();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/logs?page=2&limit=50");
  });
});
