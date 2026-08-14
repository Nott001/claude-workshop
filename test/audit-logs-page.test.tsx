// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { ROLES } from "@/shared/lib/roles";
import StaffAuditLogsPage from "@/app/staff/audit-logs/page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/modules/auth/lib/use-role-guard", () => ({ useRoleGuard: vi.fn() }));

import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";

const LONG_PAYLOAD = "x".repeat(200);

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
    metadata: { payload: LONG_PAYLOAD },
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
  it("renders logs with the action pill, actor and pagination range", async () => {
    stubFetch(logs, 25);

    render(<StaffAuditLogsPage />);

    expect(await screen.findByText("Event Created")).toBeTruthy();
    expect(screen.getByText("Ada Admin")).toBeTruthy();
    expect(screen.getByText("ada@example.com")).toBeTruthy();
    expect(screen.getByText("event #7")).toBeTruthy();
    expect(screen.getByText("1–20 of 25")).toBeTruthy();
  });

  it("filters the loaded page by category", async () => {
    stubFetch(logs, 2);

    render(<StaffAuditLogsPage />);
    await screen.findByText("Event Created");

    fireEvent.click(screen.getByRole("button", { name: "Check-in" }));

    expect(screen.getByText("ticket #42")).toBeTruthy();
    expect(screen.queryByText("event #7")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "All" }));
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

  it("opens the drawer on row click and shows the full metadata JSON", async () => {
    stubFetch(logs, 2);

    render(<StaffAuditLogsPage />);
    await screen.findByText("Check-in");

    fireEvent.click(screen.getByRole("row", { name: "View Check-in" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    const pre = dialog.querySelector("pre");
    expect(pre).toBeTruthy();
    expect(pre?.textContent).toContain(`"payload": "${LONG_PAYLOAD}"`);
    expect(pre?.textContent).not.toContain("...");
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
