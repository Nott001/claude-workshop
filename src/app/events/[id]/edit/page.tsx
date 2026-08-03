import { notFound } from "next/navigation";
import { getServiceClient } from "@/shared/db/client";
import { eventDao } from "@/shared/db/dao";
import { EditEventForm } from "@/modules/events/components/edit-event-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditEventPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = getServiceClient();
  const event = await eventDao.findByIdWithCourse(supabase, Number(id));

  if (!event) {
    notFound();
  }

  return <EditEventForm eventId={id} initialData={event} />;
}
