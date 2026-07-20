import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";
import type { UserRole } from "@/types";

const updateSchema = z.object({
  role: z.enum(["attendee", "speaker", "facilitator"]),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { userId } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { data: user, error } = await supabase
    .from("USERS")
    .update({ role: parsed.data.role as UserRole, updated_at: new Date().toISOString() })
    .eq("user_id", Number(userId))
    .select("user_id, full_name, email, role")
    .single();

  if (error) {
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  }

  return NextResponse.json(user);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { userId } = await params;
  const { userId: clerkId } = await auth();
  const supabase = getServiceClient();

  const { data: currentUser } = await supabase.from("USERS").select("user_id").eq("clerk_id", clerkId).maybeSingle();

  if (currentUser?.user_id === Number(userId)) {
    return NextResponse.json({ error: { message: "Cannot remove yourself" } }, { status: 400 });
  }

  const { error } = await supabase.from("USERS").delete().eq("user_id", Number(userId));

  if (error) {
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
