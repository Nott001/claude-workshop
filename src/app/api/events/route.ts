import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/lib/session";
import { requireMinRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import { toErrorResponse } from "@/shared/lib/error-response";
import { eventSchema } from "@/modules/events/lib/schemas";
import { createEvent, listEvents } from "@/modules/events/lib/event-service";
import { badRequest } from "@/shared/lib/api-response";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter");
  // Comma-separated so one listing can accept several: the completed tab wants
  // active and complete both, since a past event's column is only advanced when
  // someone gets round to it and the read path compensates for that.
  const statuses = searchParams.get("status")?.split(",").filter(Boolean) ?? null;
  const search = searchParams.get("search");
  const page = Number(searchParams.get("page") ?? 1);
  const limit = Number(searchParams.get("limit") ?? 50);
  const supabase = getServiceClient();

  const user = await getCurrentUser(supabase);
  const userRole = user?.role ?? null;

  const events = await listEvents(supabase, {
    role: userRole,
    userId: user?.id ?? null,
    filter,
    statuses,
    search,
    page,
    limit,
  });

  // Deliberately uncached. The anonymous listing is identical for every caller
  // and would sit in a shared cache happily, but Cloudflare honours `Vary` for
  // `Accept-Encoding` alone — so the header that keeps a signed-in caller off
  // the anonymous copy does not survive the CDN. A cache rule here has to
  // bypass on the session cookie itself; until one does, caching this would
  // hand a facilitator the public list in place of their own assignments.
  return NextResponse.json(events);
}

export async function POST(req: Request) {
  const guard = await requireMinRole(ROLES.ADMIN);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const body = await req.json();
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error);
  }

  const supabase = getServiceClient();

  try {
    const event = await createEvent(supabase, parsed.data, { id: guard.user.id });
    return NextResponse.json(event, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
