import { CommunityListPage } from "@/modules/community/pages/community-list";
import { getCurrentUser } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import { listCommunityLinks } from "@/modules/community/lib/community-service";
import { listEventMemories, MEMORY_EVENT_LIMIT } from "@/modules/events/lib/event-service";
import { toLandingEvent } from "@/modules/events/lib/landing-event";

// Per request: a card added or hidden by an admin, and an event that has just
// finished, both have to show up without a deploy.
export const dynamic = "force-dynamic";

/**
 * Both of the page's reads, resolved here instead of after hydration.
 *
 * The route was a one-line re-export of a client component that then fired two
 * independent requests, and the page could not finish painting until the slower
 * of them landed — on top of the bundle-then-hydrate wait every client route
 * pays. `Promise.all` collapses the pair into one wait, and doing it on the
 * server removes the round trip entirely.
 *
 * The hooks are unchanged in kind: they still own reloading after an edit, and
 * still fetch for themselves when no seed is handed to them, which is what the
 * staff management page relies on.
 */
export default async function CommunityRoute() {
  const supabase = getServiceClient();

  // The cards are role-aware — an admin sees hidden ones — so the role is
  // resolved here exactly as `/api/community` resolves it. An anonymous
  // visitor has none, and the service answers with the visible cards.
  const user = await getCurrentUser(supabase);

  const [links, memories] = await Promise.all([
    listCommunityLinks(supabase, user?.role ?? null),
    listEventMemories(supabase, MEMORY_EVENT_LIMIT),
  ]);

  return (
    <CommunityListPage
      initial={{
        links,
        // Through `toLandingEvent` like every other producer of these cards:
        // the table's key is `id` and the card reads `event_id`.
        memories: memories.map((memory) => ({
          event: toLandingEvent(memory.event),
          photos: memory.photos,
          photoCount: memory.photo_count,
        })),
      }}
    />
  );
}
