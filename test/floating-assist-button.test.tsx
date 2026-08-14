// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { ROLES } from "@/shared/lib/roles";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

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

import { FloatingAssistButton } from "@/modules/shell/components/floating-assist-button";

const USER = { id: 7, role: ROLES.ATTENDEE, full_name: "Grace", email: "grace@example.com" };

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        messages: [],
        session_active: true,
        session: { case_number: null, assigned_to: null, assigned_staff_name: null },
      }),
    })),
  );
}

function renderAssist(session: ReturnType<typeof useSession>) {
  useSession.mockReturnValue(session);
  return render(<FloatingAssistButton />);
}

function clickAssist() {
  fireEvent.click(screen.getByRole("button", { name: "Ask for assistance" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("FloatingAssistButton as a guest", () => {
  it("opens the sign-in dialog instead of the chat panel", () => {
    renderAssist({ user: null, isLoaded: true });

    clickAssist();

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Message support")).toBeTruthy();
    expect(within(dialog).getByText("Sign in or create an account to message a support staff.")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Type a message...")).toBeNull();
  });

  it("offers both sign-in and sign-up, returning to the current page", () => {
    renderAssist({ user: null, isLoaded: true });

    clickAssist();

    const dialog = screen.getByRole("dialog");
    const signIn = within(dialog).getByRole("link", { name: "Sign in" }) as HTMLAnchorElement;
    expect(signIn.getAttribute("href")).toBe("/sign-in?redirect_url=%2F");
    const signUp = within(dialog).getByRole("link", { name: "Create account" }) as HTMLAnchorElement;
    expect(signUp.getAttribute("href")).toBe("/sign-up?redirect_url=%2F");
  });

  it("ignores the click while the session is still loading", () => {
    renderAssist({ user: null, isLoaded: false });

    clickAssist();

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByPlaceholderText("Type a message...")).toBeNull();
  });
});

describe("FloatingAssistButton signed in", () => {
  it("toggles the chat panel and never shows the sign-in dialog", async () => {
    stubFetch();
    subscribeToSupportSessions.mockReturnValue({ id: "sessions" });

    renderAssist({ user: USER, isLoaded: true, isSignedIn: true });

    clickAssist();

    expect(await screen.findByPlaceholderText("Type a message...")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Message support")).toBeNull();
  });

  it("closes the panel on a second click", async () => {
    stubFetch();
    subscribeToSupportSessions.mockReturnValue({ id: "sessions" });

    renderAssist({ user: USER, isLoaded: true, isSignedIn: true });

    clickAssist();
    await screen.findByPlaceholderText("Type a message...");

    const panel = screen.getByPlaceholderText("Type a message...").closest("[class*='bottom-24']") as HTMLElement;
    expect(panel.classList.contains("hidden")).toBe(false);

    clickAssist();
    await waitFor(() => expect(panel.classList.contains("hidden")).toBe(true));
  });
});
