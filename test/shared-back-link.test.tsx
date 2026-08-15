// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

import { BackLink } from "@/shared/components/back-link";

afterEach(() => {
  cleanup();
});

describe("BackLink", () => {
  it("navigates by href, so it can be opened in a new tab", () => {
    render(<BackLink href="/events/7?from=community">Back to event</BackLink>);

    const link = screen.getByRole("link", { name: "Back to event" });
    expect(link.getAttribute("href")).toBe("/events/7?from=community");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps the glyph out of the accessible name", () => {
    render(<BackLink href="/events">Back to Events</BackLink>);

    // The ligature is literally the text "arrow_back": unhidden, a screen
    // reader announces it ahead of the label.
    const link = screen.getByRole("link", { name: "Back to Events" });
    expect(within(link).getByText("arrow_back").getAttribute("aria-hidden")).toBe("true");
  });

  it("takes spacing from the caller without losing its own styling", () => {
    render(
      <BackLink href="/" className="mb-8">
        Back to Home
      </BackLink>,
    );

    const className = screen.getByRole("link", { name: "Back to Home" }).className;
    expect(className).toContain("mb-8");
    expect(className).toContain("text-muted-fg");
  });
});
