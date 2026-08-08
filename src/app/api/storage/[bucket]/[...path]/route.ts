import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import * as courseDao from "@/shared/db/dao/course.dao";
import * as eventDao from "@/modules/events/db/event.dao";
import { isStorageBucket, COURSE_CONTENT_BUCKETS } from "@/shared/integrations/storage/policy";
import type { StorageBucket } from "@/shared/integrations/storage/policy";
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

/** Covers live at `events/{eventId}/cover.{ext}` — see buildEventImagePath. */
function eventIdFromPath(segments: string[]): number | null {
  if (segments[0] !== "events") return null;
  const id = Number(segments[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

interface Access {
  allowed: boolean;
  /** The bytes carry no per-user entitlement, so a shared cache may hold them. */
  cacheable: boolean;
}

const DENY: Access = { allowed: false, cacheable: false };

/**
 * A published event's cover is public: it is rendered on `/` and `/events`,
 * which anonymous visitors can read. `uploadToStorage` stores those covers as
 * `/api/storage/...`, so requiring a session here 401'd every cover for a
 * logged-out visitor and the landing page showed broken images.
 *
 * Draft covers stay behind the facilitator floor. Publishing is what makes an
 * event visible, and a guessable `events/{id}/cover.png` must not be the way
 * around that.
 */
async function resolveAccess(bucket: StorageBucket, segments: string[], supabase: Db): Promise<Access> {
  if (bucket === "event_images") {
    const eventId = eventIdFromPath(segments);
    if (eventId === null) return DENY;

    // Before the session, not after: a published cover is public and is the
    // common case, so resolving the caller first spent an auth round trip per
    // image on an answer only the draft branch reads.
    if (await eventDao.isPublished(supabase, eventId)) {
      return { allowed: true, cacheable: true };
    }
    const viewer = await requireAuth(supabase);
    return { allowed: hasMinRole(viewer?.role ?? null, "facilitator"), cacheable: false };
  }

  const user = await requireAuth(supabase);

  // Everything else still needs a session. The middleware requires one for the
  // rest of /api/*; re-checking here keeps the rule with the data it protects
  // rather than in a matcher two files away.
  if (!user) return DENY;

  if (!COURSE_CONTENT_BUCKETS.includes(bucket)) return { allowed: true, cacheable: false };

  // Facilitator *and up*: an equality test denied admins and super_admins the
  // course material every facilitator can already read.
  if (hasMinRole(user.role, "facilitator")) return { allowed: true, cacheable: false };

  const courseId = courseIdFromPath(segments);
  if (courseId === null) return DENY;

  return { allowed: await courseDao.userHasCourseAccess(supabase, user.id, courseId), cacheable: false };
}

export async function GET(_req: Request, { params }: { params: Promise<{ bucket: string; path: string[] }> }) {
  const { bucket, path } = await params;

  if (!isStorageBucket(bucket)) return refuse();
  if (!isSafePath(path)) return refuse();

  const supabase = getServiceClient();

  const access = await resolveAccess(bucket, path, supabase);
  if (!access.allowed) return refuse();

  const { data, error } = await supabase.storage.from(bucket).download(path.join("/"));

  if (error || !data) return refuse();

  return new NextResponse(data, {
    status: 200,
    headers: {
      // Anything gated on who is asking must never reach a shared cache, or it
      // gets replayed to whoever asks next. A published cover is the same bytes
      // for everyone, so that one can be cached.
      "Cache-Control": access.cacheable ? "public, max-age=3600" : "private, max-age=0, must-revalidate",
      "Content-Type": data.type || "application/octet-stream",
    },
  });
}
