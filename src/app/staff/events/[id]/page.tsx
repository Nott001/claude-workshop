import { StaffEventDetailPage } from "@/modules/events/pages/staff-event-detail";

export default async function StaffEventDetailRoute({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <StaffEventDetailPage initialTab={tab} />;
}
