// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

import { ForgotPasswordForm } from "@/modules/auth/components/forgot-password-form";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function respondWith(status: string) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status }) });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function submit(email: string) {
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));
}

describe("ForgotPasswordForm", () => {
  it("confirms the send only when the route reports one", async () => {
    respondWith("sent");

    render(<ForgotPasswordForm />);
    submit("member@example.com");

    await screen.findByText("Check your inbox");
    expect(screen.getByText(/we have sent a link to reset your password/i)).toBeTruthy();
  });

  it("tells an unregistered address that it has no account, and stays on the form", async () => {
    respondWith("unknown_email");

    render(<ForgotPasswordForm />);
    submit("stranger@example.com");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/this email is not yet registered/i);
    // The form is still there to correct a typo in place.
    expect(screen.getByLabelText("Email address")).toBeTruthy();
    expect(screen.queryByText("Check your inbox")).toBeNull();
  });

  it("distinguishes a rate-limited caller from an unregistered one", async () => {
    respondWith("rate_limited");

    render(<ForgotPasswordForm />);
    submit("member@example.com");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/too many reset requests/i);
    expect(alert.textContent).not.toMatch(/not yet registered/i);
  });

  // An outage answers `failed`, never `unknown_email` — otherwise Supabase going
  // down would tell every visitor in turn that they have no account.
  it("does not report a backend failure as an unregistered address", async () => {
    respondWith("failed");

    render(<ForgotPasswordForm />);
    submit("member@example.com");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/something went wrong/i);
    expect(alert.textContent).not.toMatch(/not yet registered/i);
  });

  it("surfaces a transport failure instead of hanging on “Sending…”", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    render(<ForgotPasswordForm />);
    submit("member@example.com");

    await screen.findByRole("alert");
    const button = screen.getByRole("button", { name: /send reset link/i });
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  // An unrecognised status must not read as success, since success is the one
  // outcome that claims an email is on its way.
  it("treats an unrecognised status as a failure rather than a send", async () => {
    respondWith("something-new");

    render(<ForgotPasswordForm />);
    submit("member@example.com");

    await screen.findByRole("alert");
    expect(screen.queryByText("Check your inbox")).toBeNull();
  });

  it("clears a previous error when the address is corrected and resubmitted", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "unknown_email" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "sent" }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<ForgotPasswordForm />);
    submit("typo@example.com");
    await screen.findByRole("alert");

    submit("member@example.com");

    await screen.findByText("Check your inbox");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  // Input styles its error border off aria-invalid, so without these the field
  // stays neutral and a screen reader never ties the message to the control.
  it("marks the field invalid and names the message that explains it", async () => {
    respondWith("unknown_email");

    render(<ForgotPasswordForm />);
    const field = screen.getByLabelText("Email address");
    expect(field.getAttribute("aria-invalid")).toBeNull();

    submit("stranger@example.com");
    const alert = await screen.findByRole("alert");

    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(field.getAttribute("aria-describedby")).toBe(alert.id);
    expect(alert.id).toBeTruthy();
  });

  it("posts the address to the recover route", async () => {
    const fetchMock = respondWith("sent");

    render(<ForgotPasswordForm />);
    submit("member@example.com");

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/recover");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ email: "member@example.com" });
  });
});
