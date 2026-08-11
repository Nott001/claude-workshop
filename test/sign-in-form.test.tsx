// @vitest-environment jsdom
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
});

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "jane@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } });
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
}

describe("SignInForm redirect_url plumbing", () => {
  it("navigates to redirect_url after a successful sign-in", async () => {
    signInWithPassword.mockResolvedValue({ error: null });

    render(<SignInForm redirectUrl="/events/5" />);
    fillAndSubmit();

    await waitFor(() => expect(window.location.assign).toHaveBeenCalledWith("/events/5"));
  });

  it("falls back to /events without a redirect_url", async () => {
    signInWithPassword.mockResolvedValue({ error: null });

    render(<SignInForm />);
    fillAndSubmit();

    await waitFor(() => expect(window.location.assign).toHaveBeenCalledWith("/events"));
  });

  it("threads redirect_url into the sign-up cross link", () => {
    render(<SignInForm redirectUrl="/events/5" />);

    const link = screen.getByRole("link", { name: /sign up/i });
    expect(link.getAttribute("href")).toBe("/sign-up?redirect_url=%2Fevents%2F5");
  });
});
