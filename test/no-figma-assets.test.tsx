// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Footer } from "@/shared/components/footer";
import { EventSessionNavbar } from "@/modules/events/components/event-session-navbar";

afterEach(() => {
  cleanup();
});

function assertNoFigmaImages(container: HTMLElement) {
  for (const img of container.querySelectorAll("img")) {
    expect(img.getAttribute("src")).not.toMatch(/^https:\/\/www\.figma\.com\//);
  }
  expect(container.innerHTML).not.toContain("figma.com");
}

describe("removed Figma MCP assets", () => {
  it("footer renders without any Figma asset URLs", () => {
    const { container } = render(<Footer />);
    assertNoFigmaImages(container);
    expect(screen.getByText(/StartupLab Business Center\. All rights reserved\./)).toBeTruthy();
  });

  it("event session navbar renders without any Figma asset URLs", () => {
    const { container } = render(
      <EventSessionNavbar
        eventName="Demo Day"
        elapsed="00:12:00"
        remaining="01:48:00"
        eventDate="2024-01-01"
        startTime="09:00:00"
        onExit={vi.fn()}
      />,
    );
    assertNoFigmaImages(container);
    expect(screen.getByText("StartupLab")).toBeTruthy();
    expect(screen.getByText("EXIT COURSE ROOM")).toBeTruthy();
  });
});
