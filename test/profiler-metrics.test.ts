// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  collectSample,
  formatBytes,
  getSamples,
  PROFILER_INTERVAL_MS,
  runSampleTick,
  subscribeToSamples,
  summarizeSample,
} from "@/modules/profiler/lib/metrics";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("collectSample", () => {
  it("produces a well-formed sample with the live-object counts", () => {
    const sample = collectSample(null);

    expect(sample.at).toBeGreaterThan(0);
    expect(sample.heapUsed).toBeNull();
    expect(sample.heapTotal).toBeNull();
    expect(sample.heapDelta).toBeNull();
    expect(sample.realtimeChannels).toBe(0);
    expect(sample.listeners).toBe(0);
    expect(sample.timers).toBe(0);
    expect(sample.domNodes).toBeGreaterThanOrEqual(0);
    expect(sample.longtaskCount).toBe(0);
    expect(sample.longtaskMaxMs).toBeNull();
    expect(sample.driftMs).toBeNull();
  });

  it("reports heap deltas when the browser exposes performance.memory", () => {
    const memory = { usedJSHeapSize: 1_000, totalJSHeapSize: 2_000 };
    Object.defineProperty(performance, "memory", { configurable: true, value: memory });

    try {
      const first = collectSample(null);
      memory.usedJSHeapSize = 1_500;
      const second = collectSample(first);

      expect(first.heapUsed).toBe(1_000);
      expect(second.heapDelta).toBe(500);
    } finally {
      Reflect.deleteProperty(performance, "memory");
    }
  });

  it("measures how far a tick drifted from its schedule", () => {
    const previous = { ...collectSample(null), at: Date.now() - PROFILER_INTERVAL_MS - 250 };
    const sample = collectSample(previous);

    expect(sample.driftMs).not.toBeNull();
    expect(sample.driftMs!).toBeGreaterThan(200);
    expect(sample.driftMs!).toBeLessThan(500);
  });
});

describe("store", () => {
  it("keeps at most the last 60 samples", () => {
    for (let i = 0; i < 70; i++) runSampleTick(null);

    expect(getSamples().length).toBe(60);
    const lastAt = getSamples()[getSamples().length - 1].at;
    const sorted = [...getSamples()].sort((a, b) => a.at - b.at);
    expect(sorted[sorted.length - 1].at).toBe(lastAt);
  });

  it("notifies subscribers on each new sample", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeToSamples(onChange);

    runSampleTick(null);
    expect(onChange).toHaveBeenCalledTimes(1);

    unsubscribe();
    runSampleTick(null);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("formatting", () => {
  it("formats byte counts readably", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("summarizes a sample into a one-line string", () => {
    const summary = summarizeSample(collectSample(null));

    expect(summary).toContain("heap=");
    expect(summary).toContain("dom=");
    expect(summary).toContain("channels=");
    expect(summary).toContain("listeners=");
    expect(summary).toContain("timers=");
    expect(summary).toContain("longtasks=0");
  });
});
