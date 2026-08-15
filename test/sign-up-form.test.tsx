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

const GOOD_PASSWORD = "the quiet kettle sings";

function acceptTerms() {
  fireEvent.click(screen.getByRole("checkbox"));
}

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText("Full Name"), { target: { value: "Jane Doe" } });
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "jane@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: GOOD_PASSWORD } });
  fireEvent.change(screen.getByLabelText("Confirm Password"), { target: { value: GOOD_PASSWORD } });
  acceptTerms();
  fireEvent.click(screen.getByRole("button", { name: /sign up/i }));
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

    fireEvent.change(screen.getByLabelText("Full Name"), { target: { value: "Jane Doe" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "jane@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } });
    fireEvent.change(screen.getByLabelText("Confirm Password"), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: /sign up/i }));

    expect((await screen.findByRole("alert")).textContent).toBe("At least 12 characters");
    expect(signUp).not.toHaveBeenCalled();
  });

  it("refuses a decorated common password that clears the length rule", async () => {
    render(<SignUpForm />);

    fireEvent.change(screen.getByLabelText("Full Name"), { target: { value: "Jane Doe" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "jane@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password1234" } });
    fireEvent.change(screen.getByLabelText("Confirm Password"), { target: { value: "password1234" } });
    fireEvent.click(screen.getByRole("button", { name: /sign up/i }));

    expect((await screen.findByRole("alert")).textContent).toBe("Not built on a commonly used password");
    expect(signUp).not.toHaveBeenCalled();
  });

  it("shows the requirements as the password is typed", () => {
    render(<SignUpForm />);

    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "abc" } });

    expect(screen.getByRole("status").textContent).toContain("of 5 password requirements met");
  });
});

describe("SignUpForm password confirmation", () => {
  function fillIdentity() {
    fireEvent.change(screen.getByLabelText("Full Name"), { target: { value: "Jane Doe" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "jane@example.com" } });
  }

  it("stays quiet while the confirmation is being typed", () => {
    render(<SignUpForm />);

    fireEvent.change(screen.getByLabelText("Password"), { target: { value: GOOD_PASSWORD } });
    fireEvent.change(screen.getByLabelText("Confirm Password"), { target: { value: "the qui" } });

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("reports the mismatch once the confirmation is left", () => {
    render(<SignUpForm />);

    fireEvent.change(screen.getByLabelText("Password"), { target: { value: GOOD_PASSWORD } });
    const confirm = screen.getByLabelText("Confirm Password");
    fireEvent.change(confirm, { target: { value: "the quiet kettle sing" } });
    fireEvent.blur(confirm);

    expect(screen.getByRole("alert").textContent).toBe("Those passwords do not match.");
    expect(confirm.getAttribute("aria-invalid")).toBe("true");
    expect(confirm.getAttribute("aria-describedby")).toBe(screen.getByRole("alert").id);
  });

  it("clears the mismatch as soon as the two agree again", () => {
    render(<SignUpForm />);

    fireEvent.change(screen.getByLabelText("Password"), { target: { value: GOOD_PASSWORD } });
    const confirm = screen.getByLabelText("Confirm Password");
    fireEvent.change(confirm, { target: { value: "the quiet kettle sing" } });
    fireEvent.blur(confirm);
    fireEvent.change(confirm, { target: { value: GOOD_PASSWORD } });

    expect(screen.queryByRole("alert")).toBeNull();
    expect(confirm.getAttribute("aria-invalid")).toBeNull();
  });

  it("refuses to create the account when the two differ, focusing the field to fix", () => {
    render(<SignUpForm />);

    fillIdentity();
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: GOOD_PASSWORD } });
    fireEvent.change(screen.getByLabelText("Confirm Password"), { target: { value: "the loud kettle sings" } });
    fireEvent.click(screen.getByRole("button", { name: /sign up/i }));

    expect(signUp).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("Those passwords do not match.");
    expect(document.activeElement).toBe(screen.getByLabelText("Confirm Password"));
  });

  it("creates the account once the two agree", async () => {
    signUp.mockResolvedValue({ error: null });

    render(<SignUpForm />);
    fillAndSubmit();

    await waitFor(() => expect(signUp).toHaveBeenCalledTimes(1));
    expect(signUp.mock.calls[0][0].password).toBe(GOOD_PASSWORD);
  });
});

describe("SignUpForm terms consent", () => {
  function fillEverythingButTerms() {
    fireEvent.change(screen.getByLabelText("Full Name"), { target: { value: "Jane Doe" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "jane@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: GOOD_PASSWORD } });
    fireEvent.change(screen.getByLabelText("Confirm Password"), { target: { value: GOOD_PASSWORD } });
  }

  it("refuses to create the account until the terms are accepted", () => {
    render(<SignUpForm />);

    fillEverythingButTerms();
    fireEvent.click(screen.getByRole("button", { name: /sign up/i }));

    expect(signUp).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("Please accept the Terms of Service and Privacy Policy to continue.");
    expect(screen.getByRole("checkbox").getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("checkbox"));
  });

  it("drops the refusal the moment the box is ticked", () => {
    render(<SignUpForm />);

    fillEverythingButTerms();
    fireEvent.click(screen.getByRole("button", { name: /sign up/i }));
    fireEvent.click(screen.getByRole("checkbox"));

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("checkbox").getAttribute("aria-invalid")).toBeNull();
  });

  it("creates the account once consent is given", async () => {
    signUp.mockResolvedValue({ error: null });

    render(<SignUpForm />);
    fillAndSubmit();

    await waitFor(() => expect(signUp).toHaveBeenCalledTimes(1));
  });

  it("points the consent links at the policies", () => {
    render(<SignUpForm />);

    expect(screen.getByRole("link", { name: "Terms of Service" }).getAttribute("href")).toBe("/terms");
    expect(screen.getByRole("link", { name: "Privacy Policy" }).getAttribute("href")).toBe("/privacy");
  });
});

describe("SignUpForm password reveal", () => {
  it("shows and re-hides each password independently", () => {
    render(<SignUpForm />);

    const password = screen.getByLabelText("Password");
    const confirm = screen.getByLabelText("Confirm Password");
    const [revealPassword, revealConfirm] = screen.getAllByRole("button", { name: "Show password" });

    expect(password.getAttribute("type")).toBe("password");

    fireEvent.click(revealPassword);
    expect(password.getAttribute("type")).toBe("text");
    expect(confirm.getAttribute("type")).toBe("password");

    fireEvent.click(revealConfirm);
    expect(confirm.getAttribute("type")).toBe("text");

    fireEvent.click(screen.getAllByRole("button", { name: "Hide password" })[0]);
    expect(password.getAttribute("type")).toBe("password");
  });
});
