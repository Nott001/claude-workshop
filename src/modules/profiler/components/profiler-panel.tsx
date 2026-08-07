"use client";

import { useEffect, useState } from "react";
import { formatBytes, getSamples, PROFILER_INTERVAL_MS, subscribeToSamples, type ProfilerSample } from "../lib/metrics";

function StatCard({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "good" | "bad";
}) {
  const tones = {
    default: "text-fg",
    good: "text-success",
    bad: "text-error",
  };
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-fg">{label}</p>
      <p className={`mt-1 text-xl font-bold ${tones[tone]}`}>{value}</p>
      {detail && <p className="mt-0.5 text-xs text-muted-fg">{detail}</p>}
    </div>
  );
}

function HeapSparkline({ samples }: { samples: ProfilerSample[] }) {
  const values = samples.map((s) => s.heapUsed).filter((v): v is number => v !== null);
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 600;
  const height = 64;
  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - 4 - ((v - min) / span) * (height - 8)).toFixed(1)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-16 w-full text-brand"
      aria-label="Heap usage over the last samples"
    >
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function ProfilerPanel() {
  const [samples, setSamples] = useState<ProfilerSample[]>(() => getSamples());

  useEffect(() => {
    const unsubscribe = subscribeToSamples(() => setSamples(getSamples()));
    return unsubscribe;
  }, []);

  const latest = samples[samples.length - 1] ?? null;

  if (!latest) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border bg-surface p-8">
        <div className="flex items-center gap-2">
          <div className="size-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <p className="text-sm text-muted-fg">Collecting the first sample...</p>
        </div>
      </div>
    );
  }

  const heapDelta = latest.heapDelta !== null ? (latest.heapDelta >= 0 ? "+" : "") + formatBytes(latest.heapDelta) : null;
  const heapTone = latest.heapDelta !== null && latest.heapDelta > 0 ? "bad" : "default";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard
          label="Heap used"
          value={latest.heapUsed !== null ? formatBytes(latest.heapUsed) : "n/a"}
          detail={heapDelta ?? "Chromium-only"}
          tone={heapTone}
        />
        <StatCard label="Realtime channels" value={String(latest.realtimeChannels)} detail="open supabase topics" />
        <StatCard label="DOM nodes" value={String(latest.domNodes)} detail="document.querySelectorAll('*')" />
        <StatCard label="Listeners" value={String(latest.listeners)} detail="addEventListener tallies" />
        <StatCard label="Timers" value={String(latest.timers)} detail="setTimeout + setInterval" />
        <StatCard
          label="Long tasks"
          value={String(latest.longtaskCount)}
          detail={latest.longtaskMaxMs !== null ? `max ${latest.longtaskMaxMs.toFixed(0)}ms since sample` : "none since sample"}
          tone={latest.longtaskMaxMs !== null && latest.longtaskMaxMs > 100 ? "bad" : "default"}
        />
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-fg">Heap trend</p>
          <p className="text-xs text-muted-fg">
            sampled every {(PROFILER_INTERVAL_MS / 1000).toFixed(0)}s
            {latest.driftMs !== null && ` · last tick drifted ${latest.driftMs}ms`}
          </p>
        </div>
        <HeapSparkline samples={samples} />
      </div>

      <p className="text-xs text-muted-fg">
        Last sample {new Date(latest.at).toLocaleTimeString()}. Each sample is printed to the terminal that ran{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-[10px]">pnpm dev</code>.
      </p>
    </div>
  );
}
