// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

const resend = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: () => ({ auth: { resend } }),
}));

import { VerifyEmailCard } from "@/modules/auth/components/verify-email-card";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("VerifyEmailCard redirect_url plumbing", () => {
  it("carries redirectUrl into the resend emailRedirectTo", async () => {
    resend.mockResolvedValue({ error: null });

    render(<VerifyEmailCard email="jane@example.com" redirectUrl="/events/5" />);
    fireEvent.click(screen.getByRole("button", { name: /resend email/i }));

    await waitFor(() => expect(resend).toHaveBeenCalled());
    const emailRedirectTo = resend.mock.calls[0][0].options.emailRedirectTo as string;
    expect(emailRedirectTo).toContain("/api/auth/callback");
    expect(emailRedirectTo).toContain("?redirect_url=%2Fevents%2F5");
  });

  it("keeps emailRedirectTo bare without a redirectUrl", async () => {
    resend.mockResolvedValue({ error: null });

    render(<VerifyEmailCard email="jane@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: /resend email/i }));

    await waitFor(() => expect(resend).toHaveBeenCalled());
    const emailRedirectTo = resend.mock.calls[0][0].options.emailRedirectTo as string;
    expect(emailRedirectTo).toContain("/api/auth/callback");
    expect(emailRedirectTo).not.toContain("redirect_url");
  });

  it("threads redirectUrl into the back-to-sign-in link", () => {
    render(<VerifyEmailCard email="jane@example.com" redirectUrl="/events/5" />);

    const link = screen.getByRole("link", { name: /back to sign in/i });
    expect(link.getAttribute("href")).toBe("/sign-in?redirect_url=%2Fevents%2F5");
  });
});
