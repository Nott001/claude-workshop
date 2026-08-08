"use client";

interface ProgressBarProps {
  progress: number;
  className?: string;
}

/**
 * A vertical progress bar that fills from top to bottom. The bar is a fixed
 * height determined by its parent; the `progress` prop (0–1) controls how
 * much of it is filled. An 8-hour event and a 4-hour event render the same
 * bar — only the fill rate differs.
 */
export function ProgressBar({ progress, className }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <div className={`relative h-full w-0.5 ${className ?? ""}`}>
      <div className="absolute inset-0 rounded-full bg-border" />
      <div
        className="absolute left-0 top-0 w-full rounded-full bg-brand transition-[height] duration-1000 ease-linear"
        style={{ height: `${clamped * 100}%` }}
      />
      <div
        className="absolute left-1/2 z-10 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand shadow-sm transition-[top] duration-1000 ease-linear"
        style={{ top: `${clamped * 100}%` }}
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-brand/30" />
      </div>
    </div>
  );
}
