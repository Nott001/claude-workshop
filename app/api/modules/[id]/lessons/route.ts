import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";
import { lessonSchema } from "@/modules/course-content";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = lessonSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();
  const { data: lesson, error } = await supabase
    .from("LESSONS")
    .insert({
      module_id: Number(id),
      description: parsed.data.description,
      content_type: parsed.data.content_type,
      content_url: parsed.data.content_url,
      total_units: parsed.data.total_units,
      sequence_order: parsed.data.sequence_order,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(lesson, { status: 201 });
}
