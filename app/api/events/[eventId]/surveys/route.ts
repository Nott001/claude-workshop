import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";
import { surveyCreateSchema } from "@/modules/surveys";

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { eventId } = await params;
  const supabase = getServiceClient();

  const { data: dbUser } = await supabase.from("USERS").select("user_id, role").eq("clerk_id", userId).single();
  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let query = supabase.from("SURVEYS").select("*, SURVEY_QUESTIONS(*)").eq("event_id", eventId);

  if (dbUser.role !== "facilitator") {
    const { data: existing } = await supabase.from("SURVEY_RESPONSES").select("survey_id").eq("user_id", dbUser.user_id);
    const submittedIds = new Set((existing ?? []).map((r) => r.survey_id));
    query = query.order("created_at", { ascending: false });
    const { data: surveys, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json((surveys ?? []).map((s) => ({ ...s, already_submitted: submittedIds.has(s.survey_id) })));
  }

  query = query.order("created_at", { ascending: false });
  const { data: surveys, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(surveys ?? []);
}

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { eventId } = await params;
  const body = await req.json();
  const parsed = surveyCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();
  const { data: survey, error } = await supabase
    .from("SURVEYS")
    .insert({ event_id: Number(eventId), title: parsed.data.title })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(survey, { status: 201 });
}
