import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as facilitatorDao from "@/shared/db/dao/facilitator.dao";

export async function GET() {
  const guard = await requireRole(ROLES.FACILITATOR);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const supabase = getServiceClient();
  const facilitators = await facilitatorDao.listCandidates(supabase);

  return NextResponse.json(facilitators);
}
