import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import { courseDao } from "@/shared/db/dao";
import { isStorageBucket, COURSE_CONTENT_BUCKETS, type StorageBucket } from "@/shared/integrations/storage";
import { hasMinRole } from "@/shared/lib/role-hierarchy";

type Db = ReturnType<typeof getServiceClient>;

// Every refusal looks the same. A caller must not be able to tell a file that
// does not exist from one they are not entitled to, or the endpoint becomes a
// way to enumerate other people's uploads.
const refuse = () => NextResponse.json({ error: "File not found" }, { status: 404 });

/**
 * Object keys are built by the path helpers in the storage integration, which
 * never emit relative or empty segments. Anything else came from a caller
 * shaping the URL by hand.
 */
function isSafePath(segments: string[]): boolean {
  if (segments.length === 0) return false;
  return segments.every((s) => s.length > 0 && s !== "." && s !== ".." && !s.includes("\\") && !s.includes("\0"));
}

/** Course material lives under `courses/{courseId}/...` — see buildCourseAssetPath. */
function courseIdFromPath(segments: string[]): number | null {
  if (segments[0] !== "courses") return null;
  const id = Number(segments[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function isEntitled(bucket: StorageBucket, segments: string[], supabase: Db): Promise<boolean> {
  // The middleware already requires a session for /api/*. Re-checking here keeps
  // the rule with the data it protects rather than in a matcher two files away.
  const user = await requireAuth(supabase);
  if (!user) return false;

  if (!COURSE_CONTENT_BUCKETS.includes(bucket)) return true;

  // Facilitator *and up*: an equality test denied admins and super_admins the
  // course material every facilitator can already read.
  if (hasMinRole(user.role, "facilitator")) return true;

  const courseId = courseIdFromPath(segments);
  if (courseId === null) return false;

  return courseDao.userHasCourseAccess(supabase, user.id, courseId);
}

export async function GET(_req: Request, { params }: { params: Promise<{ bucket: string; path: string[] }> }) {
  const { bucket, path } = await params;

  if (!isStorageBucket(bucket)) return refuse();
  if (!isSafePath(path)) return refuse();

  const supabase = getServiceClient();

  if (!(await isEntitled(bucket, path, supabase))) return refuse();

  const { data, error } = await supabase.storage.from(bucket).download(path.join("/"));

  if (error || !data) return refuse();

  return new NextResponse(data, {
    status: 200,
    headers: {
      // Entitlement is per-user, so a shared cache must not serve this to anyone else.
      "Cache-Control": "private, max-age=0, must-revalidate",
      "Content-Type": data.type || "application/octet-stream",
    },
  });
}
