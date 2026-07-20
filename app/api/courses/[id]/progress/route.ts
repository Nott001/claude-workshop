import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceClient();

  const { data: modules } = await supabase
    .from("MODULES")
    .select(
      `
      *,
      LESSONS (*)
    `,
    )
    .eq("course_id", id)
    .order("sequence_order", { foreignTable: "MODULES", ascending: true })
    .order("sequence_order", {
      foreignTable: "MODULES.LESSONS",
      ascending: true,
    });

  if (!modules) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const lessonIds = modules.flatMap((m: { LESSONS: Array<{ lesson_id: number }> }) => m.LESSONS.map((l) => l.lesson_id));

  const [allUsers, allProgress] = await Promise.all([
    supabase.from("USERS").select("user_id, full_name, email").eq("role", "attendee").order("full_name"),
    supabase.from("LESSON_PROGRESS").select("*").in("lesson_id", lessonIds),
  ]);

  return NextResponse.json({
    modules,
    progress: allProgress.data ?? [],
    users: allUsers.data ?? [],
  });
}
