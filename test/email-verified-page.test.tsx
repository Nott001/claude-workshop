// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

const { requireAuth } = vi.hoisted(() => ({ requireAuth: vi.fn() }));
vi.mock("@/modules/auth/lib/session", () => ({ requireAuth }));

import { ROLES } from "@/shared/lib/roles";
import { roleHome } from "@/modules/auth/lib/role-home";
import EmailVerifiedPage from "@/app/email-verified/page";

beforeEach(() => {
  vi.clearAllMocks();
  requireAuth.mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
});

// The sheet 12 gate succeeded, so this page's job is to route a freshly
// verified user home — the same map sign-in uses, not the attendee landing page
// for everyone.
describe("/email-verified", () => {
  async function renderPage(redirectUrl?: string) {
    const element = await EmailVerifiedPage({
      searchParams: Promise.resolve(redirectUrl ? { redirect_url: redirectUrl } : {}),
    });
    render(element);
  }

  it("sends an admin to their role home rather than the attendee landing page", async () => {
    requireAuth.mockResolvedValue({ id: 1, role: ROLES.ADMIN, full_name: "Ada", email: "ada@example.com" });
    await renderPage();

    expect(screen.getByRole("link", { name: "Go to home" }).getAttribute("href")).toBe(roleHome(ROLES.ADMIN));
    expect(roleHome(ROLES.ADMIN)).toBe("/staff/events");
  });

  it("sends an attendee to the attendee home", async () => {
    requireAuth.mockResolvedValue({ id: 1, role: ROLES.ATTENDEE, full_name: "Ada", email: "ada@example.com" });
    await renderPage();

    expect(screen.getByRole("link", { name: "Go to home" }).getAttribute("href")).toBe(roleHome(ROLES.ATTENDEE));
  });

  it("lets a safe redirect_url override the role home", async () => {
    requireAuth.mockResolvedValue({ id: 1, role: ROLES.ADMIN, full_name: "Ada", email: "ada@example.com" });
    await renderPage("/events/5");

    const link = screen.getByRole("link", { name: "Continue to event" });
    expect(link.getAttribute("href")).toBe("/events/5");
  });

  it("does not crash for an unattended visit without a session", async () => {
    // roleHome(null) falls back to "/", which is no worse than the previous
    // hard-coded /home for a link-checker that never had a session.
    await renderPage();

    expect(screen.getByRole("link", { name: "Go to home" }).getAttribute("href")).toBe("/");
  });
});
