import { EventRegisterPage } from "@/modules/events/pages/event-register";
import { BACK_LINK_PARAM, type BackLinkSearchParams } from "@/shared/lib/back-link";

export default async function EventRegisterRoute({ searchParams }: { searchParams: Promise<BackLinkSearchParams> }) {
  const params = await searchParams;
  return <EventRegisterPage from={params[BACK_LINK_PARAM]} />;
}
