import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OldCourseDetailPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/staff/courses/${id}`);
}
