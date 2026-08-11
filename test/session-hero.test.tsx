// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SessionHero } from "@/modules/events/components/session-hero";

afterEach(() => {
  cleanup();
});

describe("SessionHero", () => {
  it("renders the title and a live badge when the session is live", () => {
    render(
      <SessionHero
        title="Building AI Workflows"
        startTime="09:00:00"
        endTime="12:00:00"
        isLive
        hasEnded={false}
        progress={0.35}
      />,
    );

    expect(screen.getByText("Building AI Workflows")).toBeTruthy();
    expect(screen.getByText("Live now")).toBeTruthy();
  });

  it("shows the ended badge once the event has ended", () => {
    render(
      <SessionHero
        title="Building AI Workflows"
        startTime="09:00:00"
        endTime="12:00:00"
        isLive={false}
        hasEnded
        progress={1}
      />,
    );

    expect(screen.getByText("Ended")).toBeTruthy();
  });

  it("shows the not-started badge before the event opens", () => {
    render(
      <SessionHero
        title="Building AI Workflows"
        startTime="09:00:00"
        endTime="12:00:00"
        isLive={false}
        hasEnded={false}
        progress={0}
      />,
    );

    expect(screen.getByText("Not started")).toBeTruthy();
  });

  it("renders the speaker and formatted time range on the meta line", () => {
    render(
      <SessionHero
        title="Building AI Workflows"
        startTime="09:00:00"
        endTime="12:00:00"
        speakerName="Ada Lovelace"
        isLive
        hasEnded={false}
        progress={0.35}
      />,
    );

    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("9:00 AM – 12:00 PM")).toBeTruthy();
  });

  it("omits the time range when session edges are missing", () => {
    render(
      <SessionHero
        title="Building AI Workflows"
        startTime={null}
        endTime={null}
        speakerName="Ada Lovelace"
        isLive
        hasEnded={false}
        progress={0.5}
      />,
    );

    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.queryByText(/–/)).toBeNull();
  });

  it("fills the progress bar to the clamped percentage", () => {
    const { container } = render(
      <SessionHero
        title="Building AI Workflows"
        startTime="09:00:00"
        endTime="12:00:00"
        isLive
        hasEnded={false}
        progress={0.5}
      />,
    );

    const fill = container.querySelector("[class*='bg-brand'][class*='transition']") as HTMLElement;
    expect(fill).toBeTruthy();
    expect(fill.style.width).toBe("50%");
    expect(screen.getByText("50%")).toBeTruthy();
  });

  it("clamps progress beyond the bounds", () => {
    const { container } = render(
      <SessionHero
        title="Building AI Workflows"
        startTime="09:00:00"
        endTime="12:00:00"
        isLive={false}
        hasEnded
        progress={2}
      />,
    );

    const fill = container.querySelector("[class*='bg-brand'][class*='transition']") as HTMLElement;
    expect(fill.style.width).toBe("100%");
  });
});
