// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

// The sign-up shell renders the app's own navbar, which reads the route and the
// session. Neither exists in jsdom, and usePathname returns null without them.
const { usePathname, useSession } = vi.hoisted(() => ({
  usePathname: vi.fn(() => "/sign-up"),
  useSession: vi.fn(() => ({ user: null, isSignedIn: false, signOut: vi.fn() })),
}));
vi.mock("next/navigation", () => ({ usePathname }));
vi.mock("@/modules/auth/components/session-context", () => ({ useSession }));

import { AuthCardLayout } from "@/modules/auth/components/auth-card-layout";
import { SignUpLayout } from "@/modules/auth/components/sign-up-layout";

afterEach(() => {
  cleanup();
});

describe("the way out of an auth screen", () => {
  it.each([
    ["the sign-in card", AuthCardLayout],
    ["the sign-up page", SignUpLayout],
  ])("gives %s a link back to the landing page", (_name, Layout) => {
    render(
      <Layout>
        <p>form</p>
      </Layout>,
    );

    const back = screen.getByRole("link", { name: /back to home/i });
    expect(back.getAttribute("href")).toBe("/");
  });

  it.each([
    ["events", "/events", "Back to Events"],
    ["community", "/community", "Back to Community"],
    ["tickets", "/tickets", "Back to My Tickets"],
  ] as const)("returns to %s when the incoming link carried that origin", (origin, href, label) => {
    render(
      <AuthCardLayout backOrigin={origin}>
        <p>form</p>
      </AuthCardLayout>,
    );

    const back = screen.getByRole("link", { name: new RegExp(label, "i") });
    expect(back.getAttribute("href")).toBe(href);
  });

  it("still offers the landing page when no origin was carried", () => {
    render(
      <SignUpLayout>
        <p>form</p>
      </SignUpLayout>,
    );

    expect(screen.getByRole("link", { name: /back to home/i }).getAttribute("href")).toBe("/");
  });

  it("does not announce the arrow glyph alongside the label", () => {
    render(
      <AuthCardLayout>
        <p>form</p>
      </AuthCardLayout>,
    );

    // The ligature renders as the literal text "arrow_back", which a screen
    // reader would otherwise read out after the label.
    const back = screen.getByRole("link", { name: /back to home/i });
    expect(within(back).getByText("arrow_back").getAttribute("aria-hidden")).toBe("true");
    expect(back.textContent).toContain("Back to Home");
  });
});
