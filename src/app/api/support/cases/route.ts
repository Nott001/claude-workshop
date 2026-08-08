import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import * as chatDao from "@/shared/db/dao/chat.dao";
import { hasMinRole } from "@/shared/lib/role-hierarchy";

export async function GET() {
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user || !hasMinRole(user.role, ROLES.ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cases = await chatDao.listCases(supabase, "general");

  return NextResponse.json({ cases });
}
