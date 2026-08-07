// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { EventSessionNavbar } from "@/modules/events/components/event-session-navbar";

const baseProps = {
  eventName: "Demo Day",
  elapsed: "00:12:00",
  remaining: "01:48:00",
  eventDate: "",
  startTime: "",
  onExit: vi.fn(),
};

afterEach(() => {
  cleanup();
});

describe("EventSessionNavbar live module", () => {
  it("renders nothing extra while no module is live", () => {
    render(<EventSessionNavbar {...baseProps} />);

    expect(screen.queryByText("Live")).toBeNull();
    expect(screen.queryByText("Keynote")).toBeNull();
  });

  it("shows the live module name in the session bar", () => {
    render(<EventSessionNavbar {...baseProps} liveModuleName="Keynote" />);

    expect(screen.getByText("Live")).toBeTruthy();
    expect(screen.getByText("Keynote")).toBeTruthy();
  });

  it("shows the module's speaker alongside the live module", () => {
    render(<EventSessionNavbar {...baseProps} liveModuleName="Keynote" liveSpeakerName="Ada Lovelace" />);

    expect(screen.getByText("· Ada Lovelace")).toBeTruthy();
  });

  it("omits the speaker when the event has a single assigned speaker", () => {
    render(<EventSessionNavbar {...baseProps} liveModuleName="Keynote" liveSpeakerName={null} />);

    expect(screen.queryByText(/Ada Lovelace/)).toBeNull();
  });
});
