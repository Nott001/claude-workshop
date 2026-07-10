import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";
import { questionUpdateSchema } from "@/modules/surveys";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; questionId: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id, questionId } = await params;
  const body = await req.json();
  const parsed = questionUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();
  const { data: question, error } = await supabase
    .from("SURVEY_QUESTIONS")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("question_id", questionId)
    .eq("survey_id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(question);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; questionId: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id, questionId } = await params;
  const supabase = getServiceClient();

  const { error } = await supabase.from("SURVEY_QUESTIONS").delete().eq("question_id", questionId).eq("survey_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
