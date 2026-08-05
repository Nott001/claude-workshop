import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as auditDao from "@/shared/db/dao/audit.dao";

export async function GET(req: Request) {
  const guard = await requireRole("admin");
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));

  const supabase = getServiceClient();

  const result = await auditDao.list(supabase, page, limit);

  return NextResponse.json({ logs: result.data, total: result.total, page, limit });
}
