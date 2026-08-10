// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ROLES } from "@/shared/lib/roles";
import type { AuthUser } from "@/modules/auth/lib/types";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import { ProfileMenu } from "@/modules/shell/components/profile-menu";

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 1,
    role: ROLES.ATTENDEE,
    full_name: "Ada Lovelace",
    email: "ada@example.com",
    profile_image_url: null,
    ...overrides,
  };
}

function renderMenu(user: AuthUser = makeUser()) {
  const signOut = vi.fn().mockResolvedValue(undefined);
  const { container } = render(<ProfileMenu user={user} signOut={signOut} />);
  return { signOut, trigger: () => screen.getByRole("button", { name: "Ada Lovelace" }), container };
}

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Ada Lovelace" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => null }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ProfileMenu trigger", () => {
  it("renders the name and initials when there is no photo", () => {
    renderMenu(makeUser({ profile_image_url: null }));

    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("AL")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("renders the profile picture when profile_image_url is set", () => {
    const { container } = renderMenu(makeUser({ profile_image_url: "https://cdn/a.jpg" }));

    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://cdn/a.jpg");
  });

  it("falls back to the email's first letter for initials when the name is empty", () => {
    renderMenu(makeUser({ full_name: "", email: "ada@example.com" }));

    expect(screen.getByText("A")).toBeTruthy();
  });
});

describe("ProfileMenu dropdown", () => {
  it("opens on click and shows User settings and Sign out", () => {
    renderMenu();
    expect(screen.queryByText("User settings")).toBeNull();

    openMenu();

    expect(screen.getByText("User settings")).toBeTruthy();
    expect(screen.getByText("Sign out")).toBeTruthy();
  });

  it("links User settings to /user", () => {
    renderMenu();
    openMenu();

    const item = screen.getByRole("menuitem", { name: "User settings" });
    expect(item.tagName.toLowerCase()).toBe("a");
    expect(item.getAttribute("href")).toBe("/user");
  });

  it("calls signOut when Sign out is clicked", () => {
    const { signOut } = renderMenu();
    openMenu();

    fireEvent.click(screen.getByText("Sign out"));

    expect(signOut).toHaveBeenCalledOnce();
  });
});
