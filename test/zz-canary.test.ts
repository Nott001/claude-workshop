// CANARY — deliberate failures to prove CI actually fails. Delete with the branch.
import { describe, it, expect } from "vitest";

describe("ci canary", () => {
  it("fails on purpose so the Unit tests job must go red", () => {
    expect(1 + 1).toBe(3);
  });
});
