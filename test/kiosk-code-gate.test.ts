import { describe, it, expect } from "vitest";
import { createCodeGate } from "@/modules/kiosk/lib/code-gate";

describe("createCodeGate", () => {
  it("forwards the first token it sees", () => {
    const gate = createCodeGate();

    expect(gate.shouldForward("a")).toBe(true);
  });

  it("swallows the same token while it stays in frame (no reset)", () => {
    const gate = createCodeGate();
    gate.shouldForward("a");

    expect(gate.shouldForward("a")).toBe(false);
    expect(gate.shouldForward("a")).toBe(false);
  });

  it("forwards a different token immediately", () => {
    const gate = createCodeGate();
    gate.shouldForward("a");

    expect(gate.shouldForward("b")).toBe(true);
  });

  it("swallows the same token during the cooldown after reset", () => {
    let t = 0;
    const gate = createCodeGate({ cooldownMs: 600, now: () => t });
    gate.shouldForward("a");

    gate.reset();
    t += 100;

    expect(gate.shouldForward("a")).toBe(false);
  });

  it("forwards the same token again once the cooldown elapses after reset", () => {
    let t = 0;
    const gate = createCodeGate({ cooldownMs: 600, now: () => t });
    gate.shouldForward("a");

    gate.reset();
    t += 600;

    expect(gate.shouldForward("a")).toBe(true);
  });

  it("forwards a different token even inside the cooldown window after reset", () => {
    let t = 0;
    const gate = createCodeGate({ cooldownMs: 600, now: () => t });
    gate.shouldForward("a");

    gate.reset();
    t += 100;

    expect(gate.shouldForward("b")).toBe(true);
  });
});
