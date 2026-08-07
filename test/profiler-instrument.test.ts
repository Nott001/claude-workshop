// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { ensureInstrumented, getLiveCounts, resetLiveCounts } from "@/modules/profiler/lib/instrument";

beforeEach(() => {
  ensureInstrumented();
  resetLiveCounts();
});

describe("instrument", () => {
  it("counts addEventListener/removeEventListener pairs", () => {
    const handler = () => {};

    window.addEventListener("click", handler);
    expect(getLiveCounts().listeners).toBe(1);

    window.removeEventListener("click", handler);
    expect(getLiveCounts().listeners).toBe(0);
  });

  it("counts setTimeout and its clear", () => {
    const id = window.setTimeout(() => {}, 100);
    expect(getLiveCounts().timers).toBe(1);

    window.clearTimeout(id);
    expect(getLiveCounts().timers).toBe(0);
  });

  it("counts setInterval and its clear", () => {
    const id = window.setInterval(() => {}, 1000);
    expect(getLiveCounts().timers).toBe(1);

    window.clearInterval(id);
    expect(getLiveCounts().timers).toBe(0);
  });

  it("wraps the globals only once", () => {
    ensureInstrumented();
    const handler = () => {};

    window.addEventListener("click", handler);
    expect(getLiveCounts().listeners).toBe(1);
  });

  it("never decrements below zero", () => {
    window.clearTimeout(999);
    window.removeEventListener("click", () => {});

    expect(getLiveCounts().timers).toBe(0);
    expect(getLiveCounts().listeners).toBe(0);
  });
});
