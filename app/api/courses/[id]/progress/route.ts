import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("attendee", "speaker", "facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id } = await params;
  const { userId: clerkId } = await auth();
  const supabase = getServiceClient();

  const { data: dbUser } = await supabase.from("USERS").select("user_id, role").eq("clerk_id", clerkId).single();

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

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

  if (dbUser.role === "facilitator") {
    const { data: allUsers } = await supabase
      .from("USERS")
      .select("user_id, full_name, email")
      .eq("role", "attendee")
      .order("full_name");

    const { data: allProgress } = await supabase.from("LESSON_PROGRESS").select("*").in("lesson_id", lessonIds);

    return NextResponse.json({
      modules,
      progress: allProgress ?? [],
      users: allUsers ?? [],
    });
  }

  const { data: progress } = await supabase
    .from("LESSON_PROGRESS")
    .select("*")
    .eq("user_id", dbUser.user_id)
    .in("lesson_id", lessonIds);

  return NextResponse.json({
    modules,
    progress: progress ?? [],
    myUserId: dbUser.user_id,
  });
}
