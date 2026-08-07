import { getRealtimeChannelCount } from "@/shared/db/browser-client";
import { ensureInstrumented, getLiveCounts } from "./instrument";

export const PROFILER_INTERVAL_MS = 5000;
const SAMPLE_CAP = 60;

export interface ProfilerSample {
  at: number;
  heapUsed: number | null;
  heapTotal: number | null;
  heapDelta: number | null;
  realtimeChannels: number;
  listeners: number;
  timers: number;
  domNodes: number;
  longtaskCount: number;
  longtaskMaxMs: number | null;
  longtaskTotalMs: number | null;
  driftMs: number | null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sampleHeap(): { used: number | null; total: number | null } {
  // `performance.memory` is Chromium-only; everywhere else the heap stays null
  // and the live-object counters carry the signal.
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
  if (!memory) return { used: null, total: null };
  return { used: memory.usedJSHeapSize, total: memory.totalJSHeapSize };
}

let longtaskCount = 0;
let longtaskMax = 0;
let longtaskTotal = 0;
let longtaskObserver: PerformanceObserver | null = null;

function ensureLongTaskObserver(): void {
  if (longtaskObserver || typeof PerformanceObserver === "undefined") return;
  try {
    longtaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longtaskCount++;
        longtaskMax = Math.max(longtaskMax, entry.duration);
        longtaskTotal += entry.duration;
      }
    });
    longtaskObserver.observe({ entryTypes: ["longtask"] });
  } catch {
    // Some browsers gate longtask behind a permission prompt; the sample then
    // simply reports zeroes.
    longtaskObserver = null;
  }
}

function drainLongTasks(): { count: number; maxMs: number | null; totalMs: number | null } {
  const result = {
    count: longtaskCount,
    maxMs: longtaskMax > 0 ? longtaskMax : null,
    totalMs: longtaskTotal > 0 ? longtaskTotal : null,
  };
  longtaskCount = 0;
  longtaskMax = 0;
  longtaskTotal = 0;
  return result;
}

export function collectSample(previous: ProfilerSample | null): ProfilerSample {
  const now = Date.now();
  const { used, total } = sampleHeap();
  const longTasks = drainLongTasks();
  const live = getLiveCounts();

  return {
    at: now,
    heapUsed: used,
    heapTotal: total,
    heapDelta: previous && used !== null && previous.heapUsed !== null ? used - previous.heapUsed : null,
    realtimeChannels: getRealtimeChannelCount(),
    listeners: live.listeners,
    timers: live.timers,
    domNodes: document.querySelectorAll("*").length,
    longtaskCount: longTasks.count,
    longtaskMaxMs: longTasks.maxMs,
    longtaskTotalMs: longTasks.totalMs,
    driftMs: previous ? now - (previous.at + PROFILER_INTERVAL_MS) : null,
  };
}

export function summarizeSample(sample: ProfilerSample): string {
  const heap =
    sample.heapUsed !== null
      ? `${formatBytes(sample.heapUsed)}${sample.heapDelta !== null ? ` (${sample.heapDelta >= 0 ? "+" : ""}${formatBytes(sample.heapDelta)})` : ""}`
      : "n/a";
  const longTasks =
    sample.longtaskCount > 0
      ? `longtasks=${sample.longtaskCount}${sample.longtaskMaxMs !== null ? ` max ${sample.longtaskMaxMs.toFixed(0)}ms` : ""}`
      : "longtasks=0";
  return [
    `heap=${heap}`,
    `dom=${sample.domNodes}`,
    `channels=${sample.realtimeChannels}`,
    `listeners=${sample.listeners}`,
    `timers=${sample.timers}`,
    longTasks,
    sample.driftMs !== null ? `drift=${sample.driftMs}ms` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" ");
}

let samples: ProfilerSample[] = [];
const subscribers = new Set<() => void>();

export function getSamples(): ProfilerSample[] {
  return samples;
}

export function subscribeToSamples(onChange: () => void): () => void {
  subscribers.add(onChange);
  return () => {
    subscribers.delete(onChange);
  };
}

function pushSample(sample: ProfilerSample): void {
  samples = [...samples, sample].slice(-SAMPLE_CAP);
  for (const onChange of subscribers) onChange();
}

function reportSample(sample: ProfilerSample): void {
  console.log(`[profiler] ${summarizeSample(sample)}`);
  // The dev server prints the same line to its own stdout, so a leak is visible
  // in the terminal that ran `pnpm dev`, not just in the browser's devtools.
  void fetch("/api/dev/profiler", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sample, summary: summarizeSample(sample) }),
  }).catch(() => {});
}

export function runSampleTick(previous: ProfilerSample | null): ProfilerSample {
  const sample = collectSample(previous);
  pushSample(sample);
  reportSample(sample);
  return sample;
}

let started = false;

export function startProfiler(): void {
  if (started || typeof window === "undefined" || process.env.NODE_ENV === "production") return;
  started = true;
  ensureInstrumented();
  ensureLongTaskObserver();

  let previous: ProfilerSample | null = null;
  const tick = () => {
    previous = runSampleTick(previous);
  };

  tick();
  window.setInterval(tick, PROFILER_INTERVAL_MS);
}
