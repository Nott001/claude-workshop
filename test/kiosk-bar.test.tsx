// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { KioskBar } from "@/modules/kiosk/components/kiosk-bar";

afterEach(() => {
  cleanup();
});

describe("KioskBar", () => {
  it("names the event it is checking people into", () => {
    render(<KioskBar eventTitle="Founder Bootcamp" onExit={vi.fn()} />);

    expect(screen.getByText("StartupLab — Kiosk mode")).toBeTruthy();
    expect(screen.getByText("Founder Bootcamp")).toBeTruthy();
  });

  it("still offers the exit when no event loaded", () => {
    const onExit = vi.fn();
    render(<KioskBar eventTitle={null} onExit={onExit} />);

    fireEvent.click(screen.getByRole("button", { name: /EXIT KIOSK/ }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
