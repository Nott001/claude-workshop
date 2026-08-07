"use client";

import { useEffect } from "react";
import { startProfiler } from "./lib/metrics";

/**
 * Mounts the sampler for the lifetime of the page. `startProfiler` is
 * idempotent, so this being present in the root layout makes every route sample
 * itself; in a production bundle the module is dead-code-eliminated and this
 * renders nothing.
 */
export function ProfilerProvider() {
  useEffect(() => {
    startProfiler();
  }, []);

  return null;
}
