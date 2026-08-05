import { after } from "next/server";

/**
 * Defers work until the response has been sent.
 *
 * An isolate stops executing once its response resolves, so unregistered
 * background work is killed rather than merely delayed — `after` is what keeps
 * it alive. Outside a request scope (unit tests, scripts) `after` throws, and
 * the work runs inline instead of being silently dropped.
 */
export function afterResponse(work: () => Promise<unknown>): void {
  try {
    after(work);
  } catch {
    void work().catch((error: unknown) => console.error("Deferred work failed:", error));
  }
}
