import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { getServiceClient } from "@/shared/db/client";
import { auditDao } from "@/shared/db/dao";

export async function GET(req: Request) {
  const guard = await requireRole("admin");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));

  const supabase = getServiceClient();

  const result = await auditDao.list(supabase, page, limit);

  return NextResponse.json({ logs: result.data, total: result.total, page, limit });
}
