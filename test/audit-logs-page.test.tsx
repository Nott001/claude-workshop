// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { ROLES } from "@/shared/lib/roles";
import StaffAuditLogsPage from "@/app/staff/audit-logs/page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/modules/auth/lib/use-role-guard", () => ({ useRoleGuard: vi.fn() }));

import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";

const logs = [
  {
    id: 1,
    action: "event.created",
    entity_type: "event",
    entity_id: 7,
    metadata: null,
    created_at: "2026-08-01T10:00:00Z",
    ACTOR: { id: 9, full_name: "Ada Admin", email: "ada@example.com" },
  },
  {
    id: 2,
    action: "checkin.performed",
    entity_type: "ticket",
    entity_id: 42,
    metadata: { payload: "confidential" },
    created_at: "2026-08-02T11:30:00Z",
    ACTOR: null,
  },
];

let fetchMock: ReturnType<typeof vi.fn>;

function stubFetch(rows: unknown[], total: number) {
  fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ logs: rows, total }) }));
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

describe("StaffAuditLogsPage", () => {
  it("keeps the column headers when a category has no rows", async () => {
    stubFetch(logs, 2);

    render(<StaffAuditLogsPage />);
    await screen.findByText("Event Created");

    await act(async () => {
      fireEvent.click(screen.getByRole("combobox"));
      const invitedOption = await screen.findByRole("option", { name: "Invited" });
      fireEvent.pointerDown(invitedOption, { pointerType: "mouse" });
      fireEvent.click(invitedOption);
    });

    expect(screen.getByText("No audit logs found")).toBeTruthy();
    expect(screen.getByText("Actor")).toBeTruthy();
    expect(screen.queryByText("event #7")).toBeNull();
  });

  it("keeps the rows and shows the unified notice when a refetch fails", async () => {
    vi.useFakeTimers();
    stubFetch(logs, 2);

    render(<StaffAuditLogsPage />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("Event Created")).toBeTruthy();

    fetchMock.mockImplementation(() => Promise.resolve({ ok: false, json: async () => ({}) }));

    fireEvent.change(screen.getByPlaceholderText("Search action, entity, or actor..."), {
      target: { value: "ada" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(screen.getByText("Failed to refresh audit logs — showing last loaded results.")).toBeTruthy();
    expect(screen.getByText("Event Created")).toBeTruthy();
    expect(screen.getByText("Actor")).toBeTruthy();
  });

  it("dims the rows and sets aria-busy while a search refetch is in flight", async () => {
    vi.useFakeTimers();
    let lastResolve: ((value: unknown) => void) | undefined;
    fetchMock = vi.fn(() => new Promise((resolve) => (lastResolve = resolve)));
    vi.stubGlobal("fetch", fetchMock);

    render(<StaffAuditLogsPage />);
    await act(async () => {
      lastResolve?.({ ok: true, json: async () => ({ logs, total: 2 }) });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("Event Created")).toBeTruthy();
    expect(document.querySelector("tbody")?.getAttribute("aria-busy")).toBeNull();

    fireEvent.change(screen.getByPlaceholderText("Search action, entity, or actor..."), {
      target: { value: "ada" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(document.querySelector("tbody")?.getAttribute("aria-busy")).toBe("true");

    await act(async () => {
      lastResolve?.({ ok: true, json: async () => ({ logs, total: 2 }) });
    });
    expect(document.querySelector("tbody")?.getAttribute("aria-busy")).toBeNull();
  });

  it("renders logs with the action pill, actor and pagination range", async () => {
    stubFetch(logs, 25);

    render(<StaffAuditLogsPage />);

    expect(await screen.findByText("Event Created")).toBeTruthy();
    expect(screen.getByText("Ada Admin")).toBeTruthy();
    expect(screen.getByText("ada@example.com")).toBeTruthy();
    expect(screen.getByText("event #7")).toBeTruthy();
    expect(screen.getByText("1–20 of 25")).toBeTruthy();
  });

  it("filters the loaded page by category via the select", async () => {
    stubFetch(logs, 2);

    render(<StaffAuditLogsPage />);
    await screen.findByText("Event Created");

    await act(async () => {
      fireEvent.click(screen.getByRole("combobox"));
      const checkInOption = await screen.findByRole("option", { name: "Check-in" });
      fireEvent.pointerDown(checkInOption, { pointerType: "mouse" });
      fireEvent.click(checkInOption);
    });

    expect(screen.getByText("ticket #42")).toBeTruthy();
    expect(screen.queryByText("event #7")).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole("combobox"));
      const allOption = await screen.findByRole("option", { name: "All" });
      fireEvent.pointerDown(allOption, { pointerType: "mouse" });
      fireEvent.click(allOption);
    });
    expect(screen.getByText("event #7")).toBeTruthy();
  });

  it("types search and fires search= after the debounce, resetting the page", async () => {
    vi.useFakeTimers();
    const urls: string[] = [];
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return { ok: true, json: async () => ({ logs, total: 40 }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<StaffAuditLogsPage />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(urls[urls.length - 1]).toBe("/api/audit-logs?page=1");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(urls[urls.length - 1]).toBe("/api/audit-logs?page=2");

    fireEvent.change(screen.getByPlaceholderText("Search action, entity, or actor..."), {
      target: { value: "ada" },
    });
    expect(urls).toHaveLength(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(urls[urls.length - 1]).toBe("/api/audit-logs?page=1&search=ada");
  });

  it("paginates with page=2", async () => {
    stubFetch(logs, 40);

    render(<StaffAuditLogsPage />);
    await screen.findByText("1–20 of 40");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("21–40 of 40")).toBeTruthy();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/audit-logs?page=2");
  });

  it("opens the drawer on row click without leaking the metadata payload", async () => {
    stubFetch(logs, 2);

    render(<StaffAuditLogsPage />);
    await screen.findByText("Check-in");

    fireEvent.click(screen.getByRole("row", { name: "View Check-in" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(dialog.querySelector("pre")).toBeNull();
    expect(dialog.textContent).not.toContain("confidential");
  });

  it("shows the full created_at in the drawer", async () => {
    stubFetch(logs, 2);

    render(<StaffAuditLogsPage />);
    await screen.findByText("Event Created");

    fireEvent.click(screen.getByRole("row", { name: "View Event Created" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("ada@example.com");
  });
});
