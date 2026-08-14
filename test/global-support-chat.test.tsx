// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { ROLES } from "@/shared/lib/roles";

vi.mock("next/navigation", () => ({ usePathname: () => "/events" }));

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }));
vi.mock("@/modules/auth/components/session-context", () => ({ useSession }));

const { subscribeToSupportSessions, unsubscribe } = vi.hoisted(() => ({
  subscribeToSupportSessions: vi.fn(),
  unsubscribe: vi.fn(),
}));
vi.mock("@/shared/integrations/realtime", () => ({ subscribeToSupportSessions, unsubscribe }));

vi.mock("@/modules/chat/lib/use-realtime-messages", () => ({
  useRealtimeMessages: vi.fn(),
}));

import GlobalSupportChat from "@/modules/support/components/global-support-chat";

const USER = { id: 7, role: ROLES.ATTENDEE, full_name: "Grace", email: "grace@example.com" };

let fetchCalls: Array<{ method: string; url: string }> = [];

function mockFetch(respond: () => unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      fetchCalls.push({ method, url });
      return { ok: true, status: 200, json: async () => respond() };
    }),
  );
}

function renderChat(session: ReturnType<typeof useSession>) {
  useSession.mockReturnValue(session);
  return render(<GlobalSupportChat isOpen={true} onClose={vi.fn()} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchCalls = [];
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("GlobalSupportChat signed out", () => {
  it("holds on a loading state until the session resolves", () => {
    renderChat({ user: null, isLoaded: false });

    expect(screen.getByText("Loading...")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Type a message...")).toBeNull();
    expect(screen.queryByRole("button", { name: "Send" })).toBeNull();
  });

  it("shows a sign-in prompt instead of the composer", () => {
    mockFetch(() => ({ messages: [] }));
    subscribeToSupportSessions.mockReturnValue({ id: "sessions" });

    renderChat({ user: null, isLoaded: true });

    expect(screen.getByText("Sign in or create an account to message a support staff.")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Type a message...")).toBeNull();
    expect(screen.queryByRole("button", { name: "Send" })).toBeNull();
  });

  it("links the prompt back to the current page through sign-in and sign-up", () => {
    renderChat({ user: null, isLoaded: true });

    const signIn = screen.getByRole("link", { name: "Sign in" }) as HTMLAnchorElement;
    expect(signIn.getAttribute("href")).toBe("/sign-in?redirect_url=%2Fevents");
    const signUp = screen.getByRole("link", { name: "Create account" }) as HTMLAnchorElement;
    expect(signUp.getAttribute("href")).toBe("/sign-up?redirect_url=%2Fevents");
  });

  it("never calls the support API or subscribes as a guest", () => {
    renderChat({ user: null, isLoaded: true });

    expect(fetchCalls).toHaveLength(0);
    expect(subscribeToSupportSessions).not.toHaveBeenCalled();
  });
});

describe("GlobalSupportChat signed in", () => {
  it("renders the composer after messages load", async () => {
    mockFetch(() => ({
      messages: [],
      session_active: true,
      session: { case_number: null, assigned_to: null, assigned_staff_name: null },
    }));
    subscribeToSupportSessions.mockReturnValue({ id: "sessions" });

    renderChat({ user: USER, isLoaded: true, isSignedIn: true });

    expect(await screen.findByPlaceholderText("Type a message...")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send" })).toBeTruthy();
    expect(screen.getByText("No messages yet. How can we help?")).toBeTruthy();
  });

  it("loads messages from the support API on open", async () => {
    mockFetch(() => ({
      messages: [
        { id: 1, user_id: 7, message: "Help please", sent_at: "2026-08-05T09:00:00Z", USER: { role: ROLES.ATTENDEE } },
      ],
      session_active: true,
      session: { case_number: null, assigned_to: null, assigned_staff_name: null },
    }));
    subscribeToSupportSessions.mockReturnValue({ id: "sessions" });

    renderChat({ user: USER, isLoaded: true, isSignedIn: true });

    expect(await screen.findByText("Help please")).toBeTruthy();
    await waitFor(() => expect(fetchCalls.some((c) => c.method === "GET" && c.url === "/api/support")).toBe(true));
  });

  it("sends a typed message through the support API", async () => {
    mockFetch(() => ({
      messages: [],
      session_active: true,
      session: { case_number: null, assigned_to: null, assigned_staff_name: null },
    }));
    subscribeToSupportSessions.mockReturnValue({ id: "sessions" });

    renderChat({ user: USER, isLoaded: true, isSignedIn: true });

    const input = await screen.findByPlaceholderText("Type a message...");
    fireEvent.change(input, { target: { value: "where is it?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(fetchCalls.some((c) => c.method === "POST" && c.url === "/api/support")).toBe(true));
  });
});
