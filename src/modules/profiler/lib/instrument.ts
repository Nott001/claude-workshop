/**
 * Dev-only counting of live timers and event listeners.
 *
 * The browser exposes no way to enumerate outstanding `setTimeout`/`setInterval`
 * calls or `addEventListener` registrations, which are exactly the handles a
 * React tree leaks when a cleanup is forgotten. Wrapping the globals once turns
 * those unobservable counts into a running tally the profiler can sample.
 *
 * Wrapping a clear that targets a handle scheduled before instrumentation
 * undercounts by one, and `removeEventListener` with a `{ once: true }` capture
 * registered pre-wrap subtracts one it never added. Both are acceptable drift
 * for a signal meant to show growth, not absolute truth.
 */

export interface LiveCounts {
  timers: number;
  listeners: number;
}

let instrumented = false;
let timers = 0;
let listeners = 0;

export function getLiveCounts(): LiveCounts {
  return { timers, listeners };
}

/** Zeros the tallies without unwrapping. Test-only: re-counting a wrapped
 * environment from scratch needs a clean slate between cases. */
export function resetLiveCounts(): void {
  timers = 0;
  listeners = 0;
}

export function ensureInstrumented(): void {
  if (instrumented || typeof window === "undefined" || process.env.NODE_ENV === "production") return;
  instrumented = true;

  const nativeInterval = window.setInterval;
  const nativeClearInterval = window.clearInterval;
  const nativeTimeout = window.setTimeout;
  const nativeClearTimeout = window.clearTimeout;

  window.setInterval = ((...args: Parameters<typeof nativeInterval>) => {
    timers++;
    return nativeInterval(...args);
  }) as typeof window.setInterval;

  window.clearInterval = ((handle: ReturnType<typeof nativeInterval>) => {
    if (timers > 0) timers--;
    return nativeClearInterval(handle);
  }) as typeof window.clearInterval;

  window.setTimeout = ((...args: Parameters<typeof nativeTimeout>) => {
    timers++;
    return nativeTimeout(...args);
  }) as typeof window.setTimeout;

  window.clearTimeout = ((handle: ReturnType<typeof nativeTimeout>) => {
    if (timers > 0) timers--;
    return nativeClearTimeout(handle);
  }) as typeof window.clearTimeout;

  const nativeAdd = window.addEventListener;
  const nativeRemove = window.removeEventListener;

  window.addEventListener = ((...args: Parameters<typeof nativeAdd>) => {
    listeners++;
    return nativeAdd(...args);
  }) as typeof window.addEventListener;

  window.removeEventListener = ((...args: Parameters<typeof nativeRemove>) => {
    if (listeners > 0) listeners--;
    return nativeRemove(...args);
  }) as typeof window.removeEventListener;
}
