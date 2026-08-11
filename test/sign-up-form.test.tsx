// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

const signUp = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: () => ({ auth: { signUp } }),
}));

import { SignUpForm } from "@/modules/auth/components/sign-up-form";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Jane Doe" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "jane@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "the quiet kettle sings" } });
  fireEvent.click(screen.getByRole("button", { name: /create account/i }));
}

describe("SignUpForm redirect_url plumbing", () => {
  it("carries redirect_url into emailRedirectTo when present", async () => {
    signUp.mockResolvedValue({ error: null });

    render(<SignUpForm redirectUrl="/events/5" />);
    fillAndSubmit();

    await waitFor(() => expect(signUp).toHaveBeenCalled());
    const emailRedirectTo = signUp.mock.calls[0][0].options.emailRedirectTo as string;
    expect(emailRedirectTo).toContain("/api/auth/callback");
    expect(emailRedirectTo).toContain("?redirect_url=%2Fevents%2F5");
  });

  it("keeps emailRedirectTo bare when there is no redirect_url", async () => {
    signUp.mockResolvedValue({ error: null });

    render(<SignUpForm />);
    fillAndSubmit();

    await waitFor(() => expect(signUp).toHaveBeenCalled());
    const emailRedirectTo = signUp.mock.calls[0][0].options.emailRedirectTo as string;
    expect(emailRedirectTo).toContain("/api/auth/callback");
    expect(emailRedirectTo).not.toContain("redirect_url");
  });

  it("passes redirect_url to the verify email card", async () => {
    signUp.mockResolvedValue({ error: null });

    render(<SignUpForm redirectUrl="/events/5" />);
    fillAndSubmit();

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /back to sign in/i });
      expect(link.getAttribute("href")).toBe("/sign-in?redirect_url=%2Fevents%2F5");
    });
  });

  it("threads redirect_url into the sign-in cross link", () => {
    render(<SignUpForm redirectUrl="/events/5" />);

    const link = screen.getByRole("link", { name: /sign in/i });
    expect(link.getAttribute("href")).toBe("/sign-in?redirect_url=%2Fevents%2F5");
  });

  it("leaves the sign-in cross link bare without a redirect_url", () => {
    render(<SignUpForm />);

    const link = screen.getByRole("link", { name: /sign in/i });
    expect(link.getAttribute("href")).toBe("/sign-in");
  });
});

describe("SignUpForm password policy", () => {
  it("refuses to create the account on a weak password, naming the rule", async () => {
    render(<SignUpForm />);

    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Jane Doe" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "jane@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect((await screen.findByRole("alert")).textContent).toBe("At least 12 characters");
    expect(signUp).not.toHaveBeenCalled();
  });

  it("refuses a decorated common password that clears the length rule", async () => {
    render(<SignUpForm />);

    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Jane Doe" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "jane@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password1234" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect((await screen.findByRole("alert")).textContent).toBe("Not built on a commonly used password");
    expect(signUp).not.toHaveBeenCalled();
  });

  it("shows the requirements as the password is typed", () => {
    render(<SignUpForm />);

    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "abc" } });

    expect(screen.getByRole("status").textContent).toContain("of 5 password requirements met");
  });
});
