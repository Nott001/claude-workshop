// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ModuleScheduleBadge } from "@/modules/courses/components/module-schedule-badge";

describe("ModuleScheduleBadge", () => {
  it("renders nothing when no session is scheduled", () => {
    const { container } = render(<ModuleScheduleBadge startTime={null} endTime={null} speakerName={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when only one edge of the session is set", () => {
    const { container } = render(<ModuleScheduleBadge startTime="09:00:00" endTime={null} speakerName={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders formatted time range for a scheduled module", () => {
    render(<ModuleScheduleBadge startTime="09:00:00" endTime="10:00:00" speakerName={null} />);
    expect(screen.getByText("9:00 AM – 10:00 AM")).toBeTruthy();
  });

  it("renders 12-hour formatting across noon", () => {
    render(<ModuleScheduleBadge startTime="11:30:00" endTime="14:30:00" speakerName={null} />);
    expect(screen.getByText("11:30 AM – 2:30 PM")).toBeTruthy();
  });

  it("appends the speaker name when one is assigned", () => {
    render(<ModuleScheduleBadge startTime="09:00:00" endTime="10:00:00" speakerName="Ada Lovelace" />);
    expect(screen.getByText("9:00 AM – 10:00 AM · Ada Lovelace")).toBeTruthy();
  });
});
