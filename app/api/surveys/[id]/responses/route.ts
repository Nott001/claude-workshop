import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";
import { responseSubmitSchema, validateAnswers } from "@/modules/surveys";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceClient();

  const { data: dbUser } = await supabase.from("USERS").select("user_id, role").eq("clerk_id", userId).single();
  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (dbUser.role === "facilitator") {
    return NextResponse.json({ error: "Facilitators cannot submit survey responses" }, { status: 403 });
  }

  const { data: survey } = await supabase.from("SURVEYS").select("survey_id").eq("survey_id", id).single();
  if (!survey) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("SURVEY_RESPONSES")
    .select("response_id")
    .eq("survey_id", id)
    .eq("user_id", dbUser.user_id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "You have already submitted a response" }, { status: 409 });
  }

  const body = await req.json();
  const parsed = responseSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: questions } = await supabase
    .from("SURVEY_QUESTIONS")
    .select("question_id, submitted_type")
    .eq("survey_id", id)
    .order("sequence_order");

  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: "Survey has no questions" }, { status: 400 });
  }

  const validationError = validateAnswers(parsed.data.answers, questions);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { data: response_, error: responseError } = await supabase
    .from("SURVEY_RESPONSES")
    .insert({ survey_id: Number(id), user_id: dbUser.user_id })
    .select()
    .single();

  if (responseError) {
    return NextResponse.json({ error: responseError.message }, { status: 500 });
  }

  const answers = parsed.data.answers.map((a) => ({
    response_id: response_.response_id,
    question_id: a.question_id,
    answer_text: a.answer_text ?? null,
    answer_value: a.answer_value ?? null,
  }));

  const { error: answersError } = await supabase.from("SURVEY_ANSWERS").insert(answers);

  if (answersError) {
    return NextResponse.json({ error: answersError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, response_id: response_.response_id }, { status: 201 });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceClient();

  const { data: responses, error } = await supabase
    .from("SURVEY_RESPONSES")
    .select("*, USER:user_id(full_name, email)")
    .eq("survey_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(responses ?? []);
}
