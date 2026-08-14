import { EventDetailPage } from "@/modules/events/pages/event-detail";
import { BACK_LINK_PARAM, type BackLinkSearchParams } from "@/shared/lib/back-link";

// Read on the server so the back link is correct in the first paint. Reading it
// client-side with `useSearchParams` would need a Suspense boundary this route
// does not otherwise want.
export default async function EventDetailRoute({ searchParams }: { searchParams: Promise<BackLinkSearchParams> }) {
  const params = await searchParams;
  return <EventDetailPage from={params[BACK_LINK_PARAM]} />;
}
