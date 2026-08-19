import { EventMemoriesPage } from "@/modules/events/pages/event-memories";
import { BACK_LINK_PARAM, type BackLinkSearchParams } from "@/shared/lib/back-link";

// Read on the server so the back link is correct in the first paint, exactly as
// the event detail route does.
export default async function EventMemoriesRoute({ searchParams }: { searchParams: Promise<BackLinkSearchParams> }) {
  const params = await searchParams;
  return <EventMemoriesPage from={params[BACK_LINK_PARAM]} />;
}
