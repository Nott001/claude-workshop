import { describe, expect, it } from "vitest";

import { upcomingEvents } from "@/lib/landing";

describe("landing page content", () => {
  it("provides the two events displayed in the featured grid", () => {
    expect(upcomingEvents).toHaveLength(2);
    expect(upcomingEvents.every((event) => event.title && event.date && event.time)).toBe(true);
  });
});
