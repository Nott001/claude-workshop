import { describe, it, expect } from "vitest";
import { computeRoomCountdown } from "@/shared/lib/timer-countdown";

const NOW = new Date("2026-09-01T09:30:00");

describe("computeRoomCountdown", () => {
  it("tracks elapsed and remaining while the session is underway", () => {
    const result = computeRoomCountdown("2026-09-01", "09:00:00", "10:00:00", NOW);

    expect(result).toEqual({
      startsIn: "",
      elapsed: "00:30:00",
      remaining: "00:30:00",
      started: true,
      ended: false,
    });
  });

  it("shows the countdown and a zero elapsed before the same-day start", () => {
    const result = computeRoomCountdown("2026-09-01", "10:00:00", "11:00:00", NOW);

    expect(result).toEqual({
      startsIn: "00:30:00",
      elapsed: "00:00:00",
      remaining: "01:30:00",
      started: false,
      ended: false,
    });
  });

  it("prepends the day count when the start is a day or more away", () => {
    const result = computeRoomCountdown("2026-09-02", "14:30:00", "18:30:00", NOW);

    expect(result.startsIn).toBe("1d 05:00:00");
    expect(result.started).toBe(false);
  });

  it("clamps elapsed to the full session and clears remaining once ended", () => {
    const result = computeRoomCountdown("2026-09-01", "09:00:00", "10:00:00", new Date("2026-09-01T11:00:00"));

    expect(result).toEqual({
      startsIn: "",
      elapsed: "01:00:00",
      remaining: "00:00:00",
      started: true,
      ended: true,
    });
  });

  it("keeps remaining indeterminate when there is no end time", () => {
    const result = computeRoomCountdown("2026-09-01", "09:00:00", null, NOW);

    expect(result).toEqual({
      startsIn: "",
      elapsed: "00:30:00",
      remaining: "--:--:--",
      started: true,
      ended: false,
    });
  });

  it("treats an unparseable end time as indeterminate rather than ended", () => {
    const result = computeRoomCountdown("2026-09-01", "09:00:00", "not-a-time", NOW);

    expect(result).toEqual({
      startsIn: "",
      elapsed: "00:30:00",
      remaining: "--:--:--",
      started: true,
      ended: false,
    });
  });

  it("clamps a malformed row whose end precedes its start to a zero duration", () => {
    const result = computeRoomCountdown("2026-09-01", "10:00:00", "09:00:00", new Date("2026-09-01T11:00:00"));

    expect(result).toEqual({
      startsIn: "",
      elapsed: "00:00:00",
      remaining: "00:00:00",
      started: true,
      ended: true,
    });
  });

  it("returns neutral values when the window cannot be placed", () => {
    expect(computeRoomCountdown("", "09:00:00", "10:00:00", NOW)).toEqual({
      startsIn: "",
      elapsed: "00:00:00",
      remaining: "--:--:--",
      started: false,
      ended: false,
    });
    expect(computeRoomCountdown("2026-09-01", "", "10:00:00", NOW)).toEqual({
      startsIn: "",
      elapsed: "00:00:00",
      remaining: "--:--:--",
      started: false,
      ended: false,
    });
  });
});
