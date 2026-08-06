import { describe, it, expect } from "vitest";
import { buildTimeOptions, isOffGrid } from "@/modules/courses/lib/schedule-options";

function values(options: { value: string }[]): string[] {
  return options.map((o) => o.value);
}

describe("buildTimeOptions", () => {
  it("steps the event window in 15-minute increments, endpoints included", () => {
    const options = buildTimeOptions({ eventStart: "09:00", eventEnd: "10:00" });

    expect(values(options)).toEqual(["09:00", "09:15", "09:30", "09:45", "10:00"]);
  });

  it("labels options in 12-hour format", () => {
    const options = buildTimeOptions({ eventStart: "13:00", eventEnd: "13:15" });

    expect(options[0].label).toBe("1:00 PM");
    expect(options[1].label).toBe("1:15 PM");
  });

  it("keeps an event end that misses the step selectable", () => {
    const options = buildTimeOptions({ eventStart: "09:00", eventEnd: "10:05" });

    expect(values(options)).toContain("10:05");
  });

  it("falls back to the full day when bounds are missing", () => {
    const options = buildTimeOptions({});

    expect(values(options).includes("00:00")).toBe(true);
    expect(values(options).includes("23:45")).toBe(true);
  });

  it("falls back to the full day when the event window is inverted", () => {
    const options = buildTimeOptions({ eventStart: "17:00", eventEnd: "09:00" });

    expect(values(options).includes("23:45")).toBe(true);
  });

  it("appends a committed off-grid time without duplicating on-grid ones", () => {
    const options = buildTimeOptions({ eventStart: "09:00", eventEnd: "11:00", committed: ["09:07", "09:30"] });

    expect(values(options)).toContain("09:07");
    expect(values(options).filter((v) => v === "09:30")).toHaveLength(1);
  });
});

describe("isOffGrid", () => {
  it("flags a time that does not land on the step", () => {
    expect(isOffGrid("09:07")).toBe(true);
    expect(isOffGrid("09:00")).toBe(false);
    expect(isOffGrid("09:30")).toBe(false);
  });
});
