// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent, act } from "@testing-library/react";
import { ROLES } from "@/shared/lib/roles";
import type { UserRole } from "@/shared/types";
import type { QaMessage } from "@/shared/types";

const { subscribeToQaMessagesByModule, subscribeToModuleLock, unsubscribe } = vi.hoisted(() => ({
  subscribeToQaMessagesByModule: vi.fn(),
  subscribeToModuleLock: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("@/modules/courses/qa/lib/realtime", () => ({ subscribeToQaMessagesByModule, subscribeToModuleLock }));
vi.mock("@/shared/integrations/realtime", () => ({ unsubscribe }));

import QAPanel from "@/modules/courses/qa/components/qa-panel";

function question(id: number, message: string, role: UserRole = ROLES.ATTENDEE) {
  return {
    id,
    event_id: 9,
    module_id: 4,
    user_id: 2,
    message,
    created_at: "2026-08-05T09:00:00Z",
    updated_at: "2026-08-05T09:00:00Z",
    USER: { full_name: "Ana", role },
  };
}

function rawQuestion(id: number, message: string): QaMessage {
  return {
    id,
    event_id: 9,
    module_id: 4,
    user_id: 2,
    message,
    created_at: "2026-08-05T09:00:00Z",
    updated_at: "2026-08-05T09:00:00Z",
  };
}

interface QaCallbacks {
  onInsert?: (msg: QaMessage) => void;
  onUpdate?: (msg: QaMessage) => void;
  onDelete?: (msg: QaMessage) => void;
}

let callbacks: QaCallbacks = {};
let subscription: { name: string } = { name: "qa-module-4" };
let lockCallbacks: { onLockChange?: (locked: boolean) => void } = {};
let lockSubscription: { name: string } = { name: "module-lock-4" };

function stubRealtime() {
  callbacks = {};
  subscription = { name: "qa-module-4" };
  lockCallbacks = {};
  lockSubscription = { name: "module-lock-4" };
  subscribeToQaMessagesByModule.mockImplementation((_moduleId: number, cb: QaCallbacks) => {
    callbacks = cb;
    return subscription;
  });
  subscribeToModuleLock.mockImplementation((_moduleId: number, cb: (locked: boolean) => void) => {
    lockCallbacks = { onLockChange: cb };
    return lockSubscription;
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => (resolve = res));
  return { promise, resolve };
}

interface StubRoute {
  method: string;
  url: string;
  body?: unknown;
  status?: number;
  pending?: boolean;
  throws?: boolean;
}

function stubFetch(routes: StubRoute[], pending = new Map<string, ReturnType<typeof deferred<unknown>>>()) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = (init?.method ?? "GET").toUpperCase();
      const path = url.split("?")[0];
      const hit = routes.find((r) => r.method === method && r.url === path);
      const key = `${method} ${path}`;
      if (hit?.pending) return pending.get(key)!.promise;
      if (hit?.throws) return Promise.reject(new TypeError("Failed to fetch"));
      const status = hit?.status ?? 200;
      return { ok: status >= 200 && status < 300, status, json: async () => hit?.body ?? null };
    }),
  );
}

function renderPanel(userRole: UserRole, isSpeakerAssigned = false, isLocked = false) {
  return renderPanelRaw(
    userRole,
    [
      { method: "GET", url: "/api/qa/module/4", body: { messages: [question(1, "Any question?")] } },
      { method: "GET", url: "/api/qa/message/1", body: question(1, "Any question?") },
      { method: "GET", url: "/api/qa/message/2", body: question(2, "Follow-up") },
    ],
    isSpeakerAssigned,
    isLocked,
  );
}

function renderPanelRaw(
  userRole: UserRole,
  routes: StubRoute[],
  isSpeakerAssigned = false,
  isLocked = false,
  pending = new Map<string, ReturnType<typeof deferred<unknown>>>(),
) {
  stubFetch(routes, pending);
  return render(
    <QAPanel
      moduleId={4}
      userRole={userRole}
      isSpeakerAssigned={isSpeakerAssigned}
      eventStarted={true}
      eventEnded={false}
      isLocked={isLocked}
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

  it("renders the lock state it is seeded with", async () => {
    renderPanel(ROLES.FACILITATOR, false, true);

    await screen.findByText("Any question?");
    await waitFor(() => expect(screen.getByRole("button", { name: /unlock/i })).toBeTruthy());
  });

  it("flips the lock live when the module channel broadcasts an UPDATE", async () => {
    renderPanel(ROLES.FACILITATOR);

    await screen.findByText("Any question?");
    await waitFor(() => expect(screen.getByRole("button", { name: /locked/i })).toBeTruthy());

    lockCallbacks.onLockChange?.(true);

    await waitFor(() => expect(screen.getByRole("button", { name: /unlock/i })).toBeTruthy());
    expect(screen.queryByRole("button", { name: /locked/i })).toBeNull();
  });

  it("subscribes to the module's owned realtime channel", async () => {
    renderPanel(ROLES.ATTENDEE);

    await screen.findByText("Any question?");
    expect(subscribeToQaMessagesByModule).toHaveBeenCalledWith(4, expect.objectContaining({}));
    expect(subscribeToModuleLock).toHaveBeenCalledWith(4, expect.any(Function));
  });

  it("appends a question that arrives on the channel after enriching it", async () => {
    renderPanel(ROLES.ATTENDEE);
    await screen.findByText("Any question?");

    callbacks.onInsert?.(rawQuestion(2, "Follow-up"));

    expect(await screen.findByText("Follow-up")).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith("/api/qa/message/2");
  });

  it("dedupes an INSERT whose id is already shown", async () => {
    renderPanel(ROLES.ATTENDEE);
    await screen.findByText("Any question?");

    callbacks.onInsert?.(rawQuestion(1, "Any question?"));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/qa/message/1"));
    expect(screen.getAllByText("Any question?")).toHaveLength(1);
  });

  it("merges an UPDATE into the listed row", async () => {
    renderPanel(ROLES.ATTENDEE);
    await screen.findByText("Any question?");

    callbacks.onUpdate?.({ ...rawQuestion(1, "Edited"), id: 1 });

    expect(await screen.findByText("Edited")).toBeTruthy();
  });

  it("removes the row on DELETE", async () => {
    renderPanel(ROLES.ATTENDEE);
    await screen.findByText("Any question?");

    callbacks.onDelete?.(rawQuestion(1, "Any question?"));

    await waitFor(() => expect(screen.queryByText("Any question?")).toBeNull());
  });

  it("greys the bubble with a Deleting... mark while the DELETE is pending, then drops the row on the realtime DELETE event", async () => {
    const pending = new Map([["DELETE /api/qa/message/1", deferred<unknown>()]]);
    renderPanelRaw(
      ROLES.FACILITATOR,
      [
        {
          method: "GET",
          url: "/api/qa/module/4",
          body: { messages: [question(1, "Any question?"), question(2, "Follow-up")] },
        },
        { method: "GET", url: "/api/qa/message/1", body: question(1, "Any question?") },
        { method: "GET", url: "/api/qa/message/2", body: question(2, "Follow-up") },
        { method: "DELETE", url: "/api/qa/message/1", pending: true },
      ],
      false,
      false,
      pending,
    );

    await screen.findByText("Any question?");
    fireEvent.click(screen.getAllByRole("button", { name: "delete" })[0]);

    await waitFor(() => expect(screen.getByText("Deleting...")).toBeTruthy());
    expect(screen.getByText("Any question?").closest("div")?.className).toContain("opacity-50");
    expect(screen.getAllByRole("button", { name: "delete" })).toHaveLength(1);
    expect(screen.getByText("Follow-up").closest("div")?.className).not.toContain("opacity-50");

    pending.get("DELETE /api/qa/message/1")!.resolve({ ok: true, status: 200, json: async () => null });
    callbacks.onDelete?.(rawQuestion(1, "Any question?"));

    await waitFor(() => expect(screen.queryByText("Any question?")).toBeNull());
    expect(screen.queryByText("Deleting...")).toBeNull();
  });

  it("does not send or offer a second DELETE while one is pending", async () => {
    const pending = new Map([["DELETE /api/qa/message/1", deferred<unknown>()]]);
    renderPanelRaw(
      ROLES.FACILITATOR,
      [
        { method: "GET", url: "/api/qa/module/4", body: { messages: [question(1, "Any question?")] } },
        { method: "GET", url: "/api/qa/message/1", body: question(1, "Any question?") },
        { method: "DELETE", url: "/api/qa/message/1", pending: true },
      ],
      false,
      false,
      pending,
    );

    await screen.findByText("Any question?");
    fireEvent.click(screen.getByRole("button", { name: "delete" }));

    await waitFor(() => expect(screen.getByText("Deleting...")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "delete" })).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);

    pending.get("DELETE /api/qa/message/1")!.resolve({ ok: true, status: 200, json: async () => null });
    callbacks.onDelete?.(rawQuestion(1, "Any question?"));
    await waitFor(() => expect(screen.queryByText("Deleting...")).toBeNull());
  });

  it("treats a 404 DELETE as already deleted", async () => {
    renderPanelRaw(ROLES.FACILITATOR, [
      { method: "GET", url: "/api/qa/module/4", body: { messages: [question(1, "Any question?")] } },
      { method: "GET", url: "/api/qa/message/1", body: question(1, "Any question?") },
      { method: "DELETE", url: "/api/qa/message/1", status: 404 },
    ]);

    await screen.findByText("Any question?");
    fireEvent.click(screen.getByRole("button", { name: "delete" }));

    await waitFor(() => expect(screen.queryByText("Deleting...")).toBeNull());
    expect(screen.getByRole("button", { name: "delete" })).toBeTruthy();
    expect(screen.getByText("Any question?").closest("div")?.className).not.toContain("opacity-50");
    expect(screen.queryByText("Deleting failed")).toBeNull();

    callbacks.onDelete?.(rawQuestion(1, "Any question?"));
    await waitFor(() => expect(screen.queryByText("Any question?")).toBeNull());
  });

  it("shows a Deleting failed mark and re-enables the delete when the DELETE is refused", async () => {
    renderPanelRaw(ROLES.FACILITATOR, [
      { method: "GET", url: "/api/qa/module/4", body: { messages: [question(1, "Any question?")] } },
      { method: "GET", url: "/api/qa/message/1", body: question(1, "Any question?") },
      { method: "DELETE", url: "/api/qa/message/1", status: 500 },
    ]);

    await screen.findByText("Any question?");
    fireEvent.click(screen.getByRole("button", { name: "delete" }));

    await waitFor(() => expect(screen.getByText("Deleting failed")).toBeTruthy());
    expect(screen.getByText("Any question?").closest("div")?.className).not.toContain("opacity-50");
    expect(screen.getByRole("button", { name: "delete" })).toBeTruthy();
  });

  it("clears the Deleting failed label on its own", async () => {
    renderPanelRaw(ROLES.FACILITATOR, [
      { method: "GET", url: "/api/qa/module/4", body: { messages: [question(1, "Any question?")] } },
      { method: "GET", url: "/api/qa/message/1", body: question(1, "Any question?") },
      { method: "DELETE", url: "/api/qa/message/1", status: 500 },
    ]);

    await screen.findByText("Any question?");
    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole("button", { name: "delete" }));
      await act(async () => {});

      expect(screen.getByText("Deleting failed")).toBeTruthy();

      act(() => vi.advanceTimersByTime(2000));
      expect(screen.queryByText("Deleting failed")).toBeNull();
      expect(screen.getByRole("button", { name: "delete" })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("surfaces a network failure the same way", async () => {
    renderPanelRaw(ROLES.FACILITATOR, [
      { method: "GET", url: "/api/qa/module/4", body: { messages: [question(1, "Any question?")] } },
      { method: "GET", url: "/api/qa/message/1", body: question(1, "Any question?") },
      { method: "DELETE", url: "/api/qa/message/1", throws: true },
    ]);

    await screen.findByText("Any question?");
    fireEvent.click(screen.getByRole("button", { name: "delete" }));

    await waitFor(() => expect(screen.getByText("Deleting failed")).toBeTruthy());
    expect(screen.getByRole("button", { name: "delete" })).toBeTruthy();
  });

  it("tears both subscriptions down through the shared unsubscribe", async () => {
    const view = renderPanel(ROLES.ATTENDEE);
    await screen.findByText("Any question?");

    view.unmount();

    expect(unsubscribe).toHaveBeenCalledWith(subscription);
    expect(unsubscribe).toHaveBeenCalledWith(lockSubscription);
  });

  it("labels a speaker response with the Speaker badge", async () => {
    stubFetch([
      { method: "GET", url: "/api/qa/module/4", body: { messages: [question(1, "Here is my answer.", ROLES.SPEAKER)] } },
      { method: "GET", url: "/api/qa/message/1", body: question(1, "Here is my answer.", ROLES.SPEAKER) },
    ]);
    render(
      <QAPanel
        moduleId={4}
        userRole={ROLES.ATTENDEE}
        isSpeakerAssigned={false}
        eventStarted={true}
        eventEnded={false}
        isLocked={false}
        onToggleLock={vi.fn()}
      />,
    );

    await screen.findByText("Here is my answer.");
    const bubble = screen.getByText("Here is my answer.").closest("div");
    expect(bubble?.className).toContain("bg-warning/10");
    expect(screen.getByText("Speaker")).toBeTruthy();
    expect(screen.queryByText("Staff")).toBeNull();
  });

  it("keeps an attendee question free of role badges", async () => {
    renderPanel(ROLES.ATTENDEE);
    await screen.findByText("Any question?");
    expect(screen.getByText("Any question?").closest("div")?.className).not.toContain("bg-warning/10");
    expect(screen.queryByText("Speaker")).toBeNull();
    expect(screen.queryByText("Staff")).toBeNull();
  });

  it.each([
    ["facilitator", ROLES.FACILITATOR],
    ["admin", ROLES.ADMIN],
    ["super admin", ROLES.SUPER_ADMIN],
  ])("labels a %s response with the Staff badge", async (_label, role) => {
    stubFetch([
      { method: "GET", url: "/api/qa/module/4", body: { messages: [question(1, "A staff answer.", role)] } },
      { method: "GET", url: "/api/qa/message/1", body: question(1, "A staff answer.", role) },
    ]);
    render(
      <QAPanel
        moduleId={4}
        userRole={ROLES.ATTENDEE}
        isSpeakerAssigned={false}
        eventStarted={true}
        eventEnded={false}
        isLocked={false}
        onToggleLock={vi.fn()}
      />,
    );

    await screen.findByText("A staff answer.");
    const bubble = screen.getByText("A staff answer.").closest("div");
    expect(bubble?.className).toContain("bg-info/10");
    expect(screen.getByText("Staff")).toBeTruthy();
    expect(screen.queryByText("Speaker")).toBeNull();
  });

  it("keeps a staff bubble distinct from a speaker bubble", async () => {
    stubFetch([
      {
        method: "GET",
        url: "/api/qa/module/4",
        body: {
          messages: [question(1, "A staff answer.", ROLES.FACILITATOR), question(2, "A speaker answer.", ROLES.SPEAKER)],
        },
      },
      { method: "GET", url: "/api/qa/message/1", body: question(1, "A staff answer.", ROLES.FACILITATOR) },
      { method: "GET", url: "/api/qa/message/2", body: question(2, "A speaker answer.", ROLES.SPEAKER) },
    ]);
    render(
      <QAPanel
        moduleId={4}
        userRole={ROLES.ATTENDEE}
        isSpeakerAssigned={false}
        eventStarted={true}
        eventEnded={false}
        isLocked={false}
        onToggleLock={vi.fn()}
      />,
    );

    await screen.findByText("A staff answer.");
    expect(screen.getByText("Staff")).toBeTruthy();
    expect(screen.getByText("Speaker")).toBeTruthy();
    expect(screen.getAllByText(/answer/)).toHaveLength(2);
  });
});
