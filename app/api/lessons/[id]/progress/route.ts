import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";
import { progressSchema } from "@/modules/course-content";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("attendee");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { userId: clerkId } = await auth();
  const { id } = await params;
  const body = await req.json();
  const parsed = progressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { data: dbUser } = await supabase.from("USERS").select("user_id").eq("clerk_id", clerkId).single();

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: progress, error } = await supabase
    .from("LESSON_PROGRESS")
    .upsert(
      {
        lesson_id: Number(id),
        user_id: dbUser.user_id,
        is_completed: parsed.data.is_completed,
      },
      { onConflict: "lesson_id, user_id" },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(progress);
}
