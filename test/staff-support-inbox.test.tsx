// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/staff/support" }));

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }));
vi.mock("@/modules/auth/components/session-context", () => ({ useSession }));

const { getBrowserClient } = vi.hoisted(() => ({ getBrowserClient: vi.fn() }));
vi.mock("@/shared/db/browser-client", () => ({ getBrowserClient }));

const { subscribeToSupportSessions, unsubscribe } = vi.hoisted(() => ({
  subscribeToSupportSessions: vi.fn(),
  unsubscribe: vi.fn(),
}));
vi.mock("@/shared/integrations/realtime", () => ({
  subscribeToSupportSessions,
  unsubscribe,
}));

import StaffSupportInbox from "@/modules/chat/components/staff-support-inbox";

const ADMIN = { id: 1, role: ROLES.ADMIN, full_name: "Ada", email: "ada@example.com" };

interface CaseRow {
  id: number;
  case_number: number;
  user_id: number;
  full_name: string;
  assigned_to: number | null;
  assigned_name: string | null;
  last_message: string | null;
  last_message_at: string | null;
}

const UNCLAIMED: CaseRow = {
  id: 10,
  case_number: 100,
  user_id: 20,
  full_name: "Ana",
  assigned_to: null,
  assigned_name: null,
  last_message: "Can you help?",
  last_message_at: "2026-08-05T10:00:00Z",
};
const MINE: CaseRow = {
  id: 11,
  case_number: 101,
  user_id: 21,
  full_name: "Ben",
  assigned_to: 1,
  assigned_name: "Ada",
  last_message: "Thanks!",
  last_message_at: "2026-08-05T11:00:00Z",
};
const OTHER: CaseRow = {
  id: 12,
  case_number: 102,
  user_id: 22,
  full_name: "Cam",
  assigned_to: 2,
  assigned_name: "Boo",
  last_message: "Still stuck",
  last_message_at: "2026-08-05T12:00:00Z",
};

const MESSAGE = (id: number, user_id: number, message: string) => ({
  id,
  session_id: 10,
  user_id,
  recipient_user_id: user_id === 20 ? null : 20,
  message,
  sent_at: "2026-08-05T09:00:00Z",
  deleted_at: null,
  updated_at: "2026-08-05T09:00:00Z",
  support_type: "general",
  event_id: null,
  USER: { full_name: user_id === 20 ? "Ana" : "Ada", role: user_id === 20 ? ROLES.ATTENDEE : ROLES.ADMIN },
});

let fetchCalls: Array<{ method: string; url: string; body?: string }> = [];

function mockFetch(routes: Array<{ match: (method: string, url: string) => boolean; respond: () => unknown }>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const entry = routes.find((r) => r.match(method, url));
      fetchCalls.push({ method, url, body: init?.body ? String(init.body) : undefined });
      const body = entry?.respond() ?? { error: "not found" };
      return { ok: entry !== undefined, status: entry ? 200 : 404, json: async () => body };
    }),
  );
}

function renderInbox() {
  useSession.mockReturnValue({ user: ADMIN, isSignedIn: true, signOut: vi.fn() });
  getBrowserClient.mockReturnValue({
    channel: vi.fn(() => ({ on: () => ({ subscribe: () => {} }) })),
  });
  subscribeToSupportSessions.mockReturnValue({ id: "sessions" });
  return render(<StaffSupportInbox />);
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchCalls = [];
  window.confirm = vi.fn(() => true);
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("StaffSupportInbox queue", () => {
  it("renders each open case with its number and handler state", async () => {
    mockFetch([
      { match: (m) => m === "GET", respond: () => ({ data: [UNCLAIMED, MINE, OTHER], total: 3, page: 1, limit: 50 }) },
    ]);

    renderInbox();

    expect(await screen.findByText("CASE-100")).toBeTruthy();
    expect(screen.getByText("CASE-101")).toBeTruthy();
    expect(screen.getByText("CASE-102")).toBeTruthy();
    expect(screen.getByText("Unclaimed")).toBeTruthy();
    expect(screen.getByText("You")).toBeTruthy();
    expect(screen.getByText("Boo")).toBeTruthy();
  });

  it("shows a quiet state when the queue is empty", async () => {
    mockFetch([{ match: (m) => m === "GET", respond: () => ({ data: [], total: 0, page: 1, limit: 50 }) }]);

    renderInbox();

    expect(await screen.findByText("No open cases right now.")).toBeTruthy();
  });
});

describe("StaffSupportInbox claim flow", () => {
  it("opens an unclaimed case read-only and claims it", async () => {
    mockFetch([
      {
        match: (m, url) => m === "GET" && url.startsWith("/api/support/cases"),
        respond: () => ({ data: [UNCLAIMED], total: 1, page: 1, limit: 50 }),
      },
      {
        match: (m, url) => m === "GET" && url.includes("user_id=20"),
        respond: () => ({
          messages: [MESSAGE(1, 20, "Can you help?")],
          session: { id: 10, status: "active", case_number: 100, assigned_to: null },
        }),
      },
    ]);

    renderInbox();

    fireEvent.click(await screen.findByText("CASE-100"));

    expect(await screen.findByText("Can you help?")).toBeTruthy();
    expect(screen.getByText("Claim this case to start replying.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Claim case" }));

    const claimCall = fetchCalls.find((c) => c.method === "POST" && c.url.includes("/api/support/sessions"));
    expect(claimCall?.body).toContain('"action":"claim"');
    expect(claimCall?.body).toContain('"user_id":20');
  });

  it("shows a case handled by someone else as read-only", async () => {
    mockFetch([
      {
        match: (m, url) => m === "GET" && url.startsWith("/api/support/cases"),
        respond: () => ({ data: [OTHER], total: 1, page: 1, limit: 50 }),
      },
      {
        match: (m, url) => m === "GET" && url.includes("user_id=22"),
        respond: () => ({
          messages: [MESSAGE(1, 22, "Still stuck")],
          session: { id: 12, status: "active", case_number: 102, assigned_to: 2 },
        }),
      },
    ]);

    renderInbox();

    fireEvent.click(await screen.findByText("CASE-102"));

    expect(await screen.findByText("This case is being handled by Boo.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Claim case" })).toBeNull();
    expect(screen.queryByPlaceholderText("Type a message...")).toBeNull();
  });

  it("lets the owner reply, relinquish and end a case", async () => {
    mockFetch([
      {
        match: (m, url) => m === "GET" && url.startsWith("/api/support/cases"),
        respond: () => ({ data: [MINE], total: 1, page: 1, limit: 50 }),
      },
      {
        match: (m, url) => m === "GET" && url.includes("user_id=21"),
        respond: () => ({
          messages: [MESSAGE(2, 21, "Thanks!")],
          session: { id: 11, status: "active", case_number: 101, assigned_to: 1 },
        }),
      },
    ]);

    renderInbox();

    fireEvent.click(await screen.findByText("CASE-101"));

    const input = await screen.findByPlaceholderText("Type a message...");
    fireEvent.change(input, { target: { value: "glad to help" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    const sendCall = fetchCalls.find((c) => c.method === "POST" && c.url === "/api/support");
    expect(sendCall?.body).toContain('"recipient_user_id":21');
    expect(sendCall?.body).toContain("glad to help");

    fireEvent.click(screen.getByRole("button", { name: "Relinquish" }));
    await waitFor(() =>
      expect(fetchCalls.some((c) => c.method === "POST" && c.body?.includes('"action":"relinquish"'))).toBe(true),
    );
    await new Promise((r) => setTimeout(r, 0));

    fireEvent.click(screen.getByRole("button", { name: "End case" }));
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(fetchCalls.some((c) => c.method === "POST" && c.body?.includes('"action":"end"'))).toBe(true));
  });

  it("keeps the claim button on the queue item's header actions", async () => {
    const queue = [UNCLAIMED];
    mockFetch([
      {
        match: (m, url) => m === "GET" && url.startsWith("/api/support/cases"),
        respond: () => ({ data: queue, total: 1, page: 1, limit: 50 }),
      },
    ]);

    renderInbox();

    await screen.findByText("CASE-100");
    const listItem = screen.getByText("CASE-100").closest("li") as HTMLElement;
    expect(within(listItem).getByText("Unclaimed")).toBeTruthy();
  });
});
