import { describe, it, expect } from "vitest";
import { parseLocalDateTime } from "@/shared/lib/date-utils";

describe("parseLocalDateTime", () => {
  it("parses an unpadded time the way the ISO parser never would", () => {
    expect(parseLocalDateTime("2026-09-01", "9:00")).toEqual(new Date(2026, 8, 1, 9, 0, 0));
    expect(parseLocalDateTime("2026-09-01", "17:30")).toEqual(new Date(2026, 8, 1, 17, 30, 0));
  });

  it("keeps seconds when the source already carries them", () => {
    expect(parseLocalDateTime("2026-09-01", "09:30:45")).toEqual(new Date(2026, 8, 1, 9, 30, 45));
  });

  it("returns null rather than an Invalid Date for a bad input", () => {
    expect(parseLocalDateTime("", "9:00")).toBeNull();
    expect(parseLocalDateTime("2026-09-01", "")).toBeNull();
    expect(parseLocalDateTime("2026-09-01", "not-a-time")).toBeNull();
    expect(parseLocalDateTime("2026-13-01", "9:00")).toBeNull();
  });
});
