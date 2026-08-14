import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireMinRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as auditDao from "@/modules/audit/db/audit.dao";

export async function GET(req: Request) {
  const guard = await requireMinRole(ROLES.ADMIN);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));
  const search = searchParams.get("search");

  const supabase = getServiceClient();

  const result = await auditDao.list(supabase, { page, limit, search: search ?? undefined });

  return NextResponse.json({ logs: result.data, total: result.total, page, limit });
}
