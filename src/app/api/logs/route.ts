import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth";
import { getServiceClient } from "@/lib/db";
import { emailDao } from "@/lib/db/dao";
import { emailLogFilterSchema } from "@/modules/notifications";

export async function GET(req: Request) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const filters = {
    email_type: searchParams.get("email_type") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    user_id: searchParams.get("user_id") ?? undefined,
    date_from: searchParams.get("date_from") ?? undefined,
    date_to: searchParams.get("date_to") ?? undefined,
  };

  const parsed = emailLogFilterSchema.safeParse(filters);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();

  const logs = await emailDao.list(supabase, {
    ...parsed.data,
    user_id: parsed.data.user_id?.toString(),
  });

  return NextResponse.json(logs);
}
