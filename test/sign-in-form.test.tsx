// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

const signInWithPassword = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: () => ({ auth: { signInWithPassword } }),
}));

// jsdom's window.location properties are non-configurable, so the assign stub
// replaces the whole location getter once rather than re-spying per test.
const assign = vi.fn();
vi.spyOn(window, "location", "get").mockReturnValue({ assign } as unknown as Location);

import { SignInForm } from "@/modules/auth/components/sign-in-form";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "jane@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } });
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
}

function signInAs(role: string) {
  signInWithPassword.mockResolvedValue({ error: null });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 1, role }) }));
  render(<SignInForm />);
  fillAndSubmit();
}

describe("SignInForm redirect_url plumbing", () => {
  it("navigates to redirect_url after a successful sign-in", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    vi.stubGlobal("fetch", vi.fn());

    render(<SignInForm redirectUrl="/events/5" />);
    fillAndSubmit();

    await waitFor(() => expect(window.location.assign).toHaveBeenCalledWith("/events/5"));
  });

  it("threads redirect_url into the sign-up cross link", () => {
    render(<SignInForm redirectUrl="/events/5" />);

    const link = screen.getByRole("link", { name: "Create an account" });
    expect(link.getAttribute("href")).toBe("/sign-up?redirect_url=%2Fevents%2F5");
  });

  it("leaves the sign-up cross link bare without a redirect_url", () => {
    render(<SignInForm />);

    expect(screen.getByRole("link", { name: "Create an account" }).getAttribute("href")).toBe("/sign-up");
  });

  it("offers the password reset route to a locked-out user", () => {
    render(<SignInForm />);

    expect(screen.getByRole("link", { name: "Forgot Password?" }).getAttribute("href")).toBe("/forgot-password");
  });

  it("lets the password be revealed before it is submitted", () => {
    render(<SignInForm />);

    const password = screen.getByLabelText("Password");
    expect(password.getAttribute("type")).toBe("password");

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password.getAttribute("type")).toBe("text");
  });
});

describe("SignInForm role-based destination", () => {
  it.each([
    [ROLES.SPEAKER, "/speaker/events"],
    [ROLES.ATTENDEE, "/"],
    [ROLES.ADMIN, "/staff/events"],
    [ROLES.SUPER_ADMIN, "/staff/events"],
    [ROLES.FACILITATOR, "/staff/events/assigned"],
  ])("sends %s to %s", async (role, dest) => {
    signInAs(role);
    await waitFor(() => expect(window.location.assign).toHaveBeenCalledWith(dest));
  });

  it("sends an unmapped role to the root rather than nowhere", async () => {
    signInAs("wizard");
    await waitFor(() => expect(window.location.assign).toHaveBeenCalledWith("/"));
  });

  it("falls back to the root when the role cannot be resolved", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    render(<SignInForm />);
    fillAndSubmit();

    await waitFor(() => expect(window.location.assign).toHaveBeenCalledWith("/"));
  });
});

describe("SignInForm auth error copy", () => {
  it("names the wait instead of the raw {} when a 429 rate-limits the attempt", async () => {
    signInWithPassword.mockResolvedValue({ error: { status: 429, message: "{}" } });

    render(<SignInForm />);
    fillAndSubmit();

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Too many attempts. Please wait, then try again."));
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it("falls back to sign-in copy for a {} error that is not a rate limit", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "{}" } });

    render(<SignInForm />);
    fillAndSubmit();

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("We could not sign you in. Please try again."));
  });

  it("keeps a usable provider message", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });

    render(<SignInForm />);
    fillAndSubmit();

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Invalid login credentials"));
  });
});
