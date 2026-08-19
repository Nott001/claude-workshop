import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import { listReleasedCourses } from "@/modules/courses/lib/course-entitlement";

/**
 * The courses whose after-event material this caller can now read.
 *
 * Answers for the caller and nobody else: the user id comes from the session,
 * never the query string, so the listing cannot be pointed at someone else's
 * ticket history.
 */
export async function GET() {
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  return NextResponse.json({ courses: await listReleasedCourses(supabase, user.id) });
}
