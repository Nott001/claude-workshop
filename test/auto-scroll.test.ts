import { describe, it, expect } from "vitest";
import { isNearBottom } from "@/modules/chat/lib/auto-scroll";

describe("isNearBottom", () => {
  it("treats the very bottom as near", () => {
    expect(isNearBottom(500, 400, 100)).toBe(true);
  });

  it("treats a small gap as near", () => {
    expect(isNearBottom(500, 320, 100)).toBe(true);
  });

  it("is false while the reader is far from the bottom", () => {
    expect(isNearBottom(500, 100, 100)).toBe(false);
  });
});
