import { EventListPage } from "@/modules/events/pages/event-list";
import { getCurrentUser } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import { listEvents } from "@/modules/events/lib/event-service";
import { PAGE_SIZE, tabScope } from "@/modules/events/lib/event-list-query";

// Rendered per request, like the landing page and for the same reason: the
// listing changes whenever staff publish an event, and a page prerendered at
// build time would serve whatever was true at deploy.
export const dynamic = "force-dynamic";

/**
 * The first page of events, fetched here rather than after hydration.
 *
 * The route used to be a one-line re-export of a client component, so a visitor
 * waited out four steps before seeing anything: HTML, the JS bundle, hydration,
 * and only then the request for the rows. The landing page has always rendered
 * its events on the server, which is the whole of why it felt faster than this
 * one for the same data.
 *
 * The query matches the tab the list opens on — Upcoming, published only, no
 * search — so the seed answers exactly what the hook would have asked for.
 * Every tab and keystroke after that still goes through the API.
 *
 * `tabScope` rather than a filter and status set written out again here: the
 * seed only saves a round trip while it asks the question the hook would have,
 * and two copies of that question are free to drift apart silently.
 */
export default async function EventsRoute() {
  const supabase = getServiceClient();

  // Resolved here so the seed is scoped the same way `/api/events` would scope
  // it. An anonymous visitor simply has no role, and the service answers with
  // the published listing.
  const user = await getCurrentUser(supabase);

  const scope = tabScope("upcoming", false);
  const initial = await listEvents(supabase, {
    role: user?.role ?? null,
    userId: user?.id ?? null,
    filter: scope.filter ?? null,
    statuses: scope.statuses ?? null,
    page: 1,
    limit: PAGE_SIZE,
  });

  return <EventListPage initial={{ rows: initial.data, total: initial.total }} />;
}
