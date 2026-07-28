import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { getServiceClient } from "@/shared/db/client";
import { emailDao } from "@/shared/db/dao";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceClient();

  const log = await emailDao.findById(supabase, Number(id));

  if (!log) {
    return NextResponse.json({ error: "Log not found" }, { status: 404 });
  }

  return NextResponse.json(log);
}
