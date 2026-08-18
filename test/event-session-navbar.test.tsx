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

describe("EventSessionNavbar ended state", () => {
  it("shows an Ended label and hides the timer once the event has ended", () => {
    render(<EventSessionNavbar {...baseProps} hasEnded eventDate="2024-01-01" startTime="09:00:00" />);

    expect(screen.getByText("Ended")).toBeTruthy();
    expect(screen.queryByText("Elapsed")).toBeNull();
    expect(screen.queryByText("Remaining")).toBeNull();
  });

  it("keeps the timer visible before the event ends", () => {
    render(<EventSessionNavbar {...baseProps} eventDate="2024-01-01" startTime="09:00:00" />);

    expect(screen.queryByText("Ended")).toBeNull();
    expect(screen.getByText("Elapsed")).toBeTruthy();
    expect(screen.getByText("Remaining")).toBeTruthy();
  });

  it("suppresses the live chip once the event has ended", () => {
    render(<EventSessionNavbar {...baseProps} hasEnded liveModuleName="Keynote" eventDate="2024-01-01" startTime="09:00:00" />);

    expect(screen.getByText("Ended")).toBeTruthy();
    expect(screen.queryByText("Live")).toBeNull();
    expect(screen.queryByText("Keynote")).toBeNull();
  });
});
