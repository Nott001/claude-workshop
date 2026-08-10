// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

const { redirect, requireAuth } = vi.hoisted(() => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  requireAuth: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/modules/auth/lib/session", () => ({ requireAuth }));
vi.mock("@/modules/user/components/account-settings", () => ({
  AccountSettings: () => <div>Account Settings stub</div>,
}));

import UserSettingsPage from "@/app/user/[[...rest]]/page";

const user = { id: 1, role: ROLES.SPEAKER, full_name: "Ada", email: "ada@example.com", profile_image_url: null };

afterEach(() => {
  cleanup();
});

describe("UserSettingsPage route", () => {
  it("renders the settings page for an authenticated user", async () => {
    requireAuth.mockResolvedValue(user);

    render(await UserSettingsPage());

    expect(screen.getByText("Account Settings stub")).toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects an anonymous visitor to sign-in before rendering anything", async () => {
    requireAuth.mockResolvedValue(null);

    await expect(UserSettingsPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/sign-in?redirect_url=/user");
  });
});
