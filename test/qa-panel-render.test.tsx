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

import QAPanel from "@/modules/chat/components/qa-panel";

function question(id: number, message: string) {
  return {
    id,
    event_id: 9,
    module_id: 4,
    user_id: 2,
    message,
    created_at: "2026-08-05T09:00:00Z",
    deleted_at: null,
    updated_at: "2026-08-05T09:00:00Z",
    USER: { full_name: "Ana", role: ROLES.ATTENDEE },
  };
}

let handler: (payload: { eventType: string; new?: unknown; old?: unknown }) => void = () => {};

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

function renderPanel(userRole: UserRole, isSpeakerAssigned = false) {
  stubFetch([
    { method: "GET", url: "/api/qa/module/4", body: { messages: [question(1, "Any question?")] } },
    { method: "GET", url: "/api/qa/message/1", body: question(1, "Any question?") },
    { method: "GET", url: "/api/qa/message/2", body: question(2, "Follow-up") },
  ]);
  return render(
    <QAPanel
      moduleId={4}
      userRole={userRole}
      isSpeakerAssigned={isSpeakerAssigned}
      eventStarted={true}
      eventEnded={false}
      isLocked={false}
      onToggleLock={vi.fn()}
    />,
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

describe("QAPanel", () => {
  it("loads questions and renders the shared composer", async () => {
    renderPanel(ROLES.ATTENDEE);

    expect(await screen.findByText("Any question?")).toBeTruthy();
    expect(screen.getByPlaceholderText("Ask a question...")).toBeTruthy();
  });

  it("keeps the lock toggle and delete away from attendees", async () => {
    renderPanel(ROLES.ATTENDEE);

    await screen.findByText("Any question?");
    expect(screen.queryByRole("button", { name: /lock/i })).toBeNull();
    expect(screen.queryByRole("button", { name: "delete" })).toBeNull();
  });

  it("shows the lock toggle and delete to facilitators", async () => {
    renderPanel(ROLES.FACILITATOR);

    await screen.findByText("Any question?");
    await waitFor(() => expect(screen.getByRole("button", { name: /lock/i })).toBeTruthy());
    expect(screen.getAllByRole("button", { name: "delete" }).length).toBeGreaterThan(0);
  });

  it("admits an assigned speaker to the moderation controls", async () => {
    renderPanel(ROLES.SPEAKER, true);

    await screen.findByText("Any question?");
    await waitFor(() => expect(screen.getByRole("button", { name: /lock/i })).toBeTruthy());
    expect(screen.getAllByRole("button", { name: "delete" }).length).toBeGreaterThan(0);
  });

  it("keeps moderation away from a speaker who is not assigned", async () => {
    renderPanel(ROLES.SPEAKER, false);

    await screen.findByText("Any question?");
    expect(screen.queryByRole("button", { name: /lock/i })).toBeNull();
    expect(screen.queryByRole("button", { name: "delete" })).toBeNull();
  });

  it("appends a question that arrives on the channel", async () => {
    renderPanel(ROLES.ATTENDEE);
    await screen.findByText("Any question?");

    handler({ eventType: "INSERT", new: question(2, "Follow-up") });

    expect(await screen.findByText("Follow-up")).toBeTruthy();
  });
});
