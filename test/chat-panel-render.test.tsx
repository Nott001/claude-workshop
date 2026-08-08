// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { ROLES } from "@/shared/lib/roles";
import type { UserRole } from "@/shared/types";

const { getBrowserClient, unsubscribe } = vi.hoisted(() => ({
  getBrowserClient: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("@/shared/db/browser-client", () => ({ getBrowserClient }));
vi.mock("@/shared/integrations/realtime", () => ({ unsubscribe }));

import ChatPanel from "@/modules/chat/components/chat-panel";

interface MessageRow {
  id: number;
  user_id: number;
  recipient_user_id: number | null;
  message: string;
  support_type: string;
  event_id: number | null;
}

function message(id: number, message: string, over: Partial<MessageRow> = {}): MessageRow {
  return {
    id,
    user_id: 2,
    recipient_user_id: null,
    message,
    support_type: "event",
    event_id: 9,
    ...over,
  };
}

let handler: (payload: { eventType: string; new?: MessageRow; old?: MessageRow }) => void = () => {};

function stubRealtime() {
  getBrowserClient.mockReturnValue({
    channel: vi.fn(() => ({
      on: vi.fn((_event: string, _config: unknown, h: typeof handler) => {
        handler = h;
        return { subscribe: () => ({}) };
      }),
    })),
  });
}

function stubFetch(responses: Array<{ method: string; url: string; body: unknown }>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = (init?.method ?? "GET").toUpperCase();
      const path = url.split("?")[0];
      const hit = responses.find((r) => r.method === method && r.url === path);
      return { ok: true, json: async () => hit?.body ?? null };
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  stubRealtime();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPanel(userRole: UserRole) {
  stubFetch([
    { method: "GET", url: "/api/support", body: { messages: [message(1, "Hi there")] } },
    { method: "GET", url: "/api/support/1", body: message(1, "Hi there") },
    { method: "GET", url: "/api/support/2", body: message(2, "Just arrived") },
  ]);
  return render(<ChatPanel eventId="9" supportType="event" userRole={userRole} currentUserId={2} />);
}

describe("ChatPanel", () => {
  it("loads the thread and renders it through the shared composer", async () => {
    renderPanel(ROLES.ATTENDEE);

    expect(await screen.findByText("Hi there")).toBeTruthy();
    expect(screen.getByPlaceholderText("Type a message...")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send" })).toBeTruthy();
  });

  it("keeps the delete affordance away from non-staff", async () => {
    renderPanel(ROLES.ATTENDEE);

    await screen.findByText("Hi there");
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("exposes delete to facilitators", async () => {
    renderPanel(ROLES.FACILITATOR);

    await screen.findByText("Hi there");
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Delete" }).length).toBeGreaterThan(0));
  });

  it("appends a new message that arrives on the channel", async () => {
    renderPanel(ROLES.ATTENDEE);
    await screen.findByText("Hi there");

    handler({ eventType: "INSERT", new: message(2, "Just arrived") });

    expect(await screen.findByText("Just arrived")).toBeTruthy();
  });
});
