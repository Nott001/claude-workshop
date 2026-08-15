import type { AuthChangeEvent } from "@supabase/supabase-js";

/**
 * True when an auth event means the session changed after this page's initial
 * render and the server components under it need re-running.
 *
 * INITIAL_SESSION is emitted on every mount with whatever session is already
 * in storage — the page just finished a server render, so refreshing then is
 * redundant, and on a URL with no matching route (a 404) it leaves the router
 * with nothing to refresh and Next recovers by reloading the page, which 404s
 * and reloads again.
 */
export function shouldRefreshRouterForAuthEvent(event: AuthChangeEvent): boolean {
  return event !== "INITIAL_SESSION";
}
