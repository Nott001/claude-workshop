import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";
import { eventPartialSchema } from "@/modules/event-management";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const { data: event, error } = await supabase
    .from("EVENTS")
    .select("*, COURSE(*), EVENT_SPEAKERS(SPEAKER_PROFILES(*))")
    .eq("event_id", id)
    .single();

  if (error || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json(event);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = eventPartialSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();
  const { data: event, error } = await supabase.from("EVENTS").update(parsed.data).eq("event_id", id).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(event);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceClient();

  const { data: payments } = await supabase.from("PAYMENTS").select("payment_id").eq("event_id", id).limit(1);

  if (payments && payments.length > 0) {
    return NextResponse.json({ error: "Cannot delete event with existing payments" }, { status: 409 });
  }

  const { error } = await supabase.from("EVENTS").delete().eq("event_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
