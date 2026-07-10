import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; responseId: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id, responseId } = await params;
  const supabase = getServiceClient();

  const { data: response_, error } = await supabase
    .from("SURVEY_RESPONSES")
    .select("*, USER:user_id(full_name, email), SURVEY_ANSWERS(*)")
    .eq("response_id", responseId)
    .eq("survey_id", id)
    .single();

  if (error || !response_) {
    return NextResponse.json({ error: "Response not found" }, { status: 404 });
  }
  return NextResponse.json(response_);
}
