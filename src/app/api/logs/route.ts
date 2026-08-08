import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireMinRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as emailDao from "@/shared/db/dao/email.dao";
import { emailLogFilterSchema } from "@/modules/notifications/lib/email-log-schema";

export async function GET(req: Request) {
  const guard = await requireMinRole(ROLES.ADMIN);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { searchParams } = new URL(req.url);
  const filters = {
    email_type: searchParams.get("email_type") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    user_id: searchParams.get("user_id") ?? undefined,
    date_from: searchParams.get("date_from") ?? undefined,
    date_to: searchParams.get("date_to") ?? undefined,
    page: Number(searchParams.get("page") ?? 1),
    limit: Number(searchParams.get("limit") ?? 50),
  };

  const parsed = emailLogFilterSchema.safeParse(filters);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();

  const logs = await emailDao.list(supabase, {
    ...parsed.data,
    user_id: parsed.data.user_id?.toString(),
    page: filters.page,
    limit: filters.limit,
  });

  return NextResponse.json(logs);
}
