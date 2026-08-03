import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import { eventDao } from "@/shared/db/dao";
import { eventSchema } from "@/modules/events/lib/schemas";
import { logAuditEvent } from "@/modules/audit";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter");
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  const userRole = user?.role ?? null;

  const events = await eventDao.list(supabase, { role: userRole, filter });

  return NextResponse.json(events);
}

export async function POST(req: Request) {
  const guard = await requireRole("admin");
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const body = await req.json();
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();

  const event = await eventDao.create(supabase, {
    title: parsed.data.title,
    event_date: parsed.data.event_date,
    start_time: parsed.data.start_time,
    end_time: parsed.data.end_time,
    venue_name: parsed.data.venue_name,
    venue_address: parsed.data.venue_address ?? null,
    description: parsed.data.description ?? null,
    price: parsed.data.price ?? 0,
    currency: parsed.data.currency ?? "PHP",
    cover_image_url: parsed.data.cover_image_url ?? null,
    status: "draft",
  });

  if (!event) {
    return NextResponse.json({ error: { message: "Failed to create event" } }, { status: 500 });
  }

  await logAuditEvent(supabase, guard.user.id, "event.created", "event", event.id, {
    title: event.title,
  });

  return NextResponse.json(event, { status: 201 });
}
