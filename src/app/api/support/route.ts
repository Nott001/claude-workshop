import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { forbidden, guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as chatDao from "@/shared/db/dao/chat.dao";
import { sendMessageSchema, supportTypeEnum } from "@/modules/chat/lib/schemas";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import {
  openOrReuseSession,
  rateLimitCheck,
  sendSupportMessage,
  SupportServiceError,
} from "@/modules/chat/lib/support-service";

function mapError(err: unknown): NextResponse {
  if (err instanceof SupportServiceError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  throw err;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const before = searchParams.get("before");
  const after = searchParams.get("after");
  const filterUserId = searchParams.get("user_id");
  const supportTypeParam = searchParams.get("support_type") ?? "general";
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 50);

  const parsedType = supportTypeEnum.safeParse(supportTypeParam);
  if (!parsedType.success) {
    return NextResponse.json({ error: "Invalid support_type" }, { status: 400 });
  }
  const supportType = parsedType.data;

  const supabase = getServiceClient();

  const guard = await requireRole();
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  if (!hasMinRole(guard.user.role, ROLES.ADMIN) && guard.user.role !== ROLES.ATTENDEE) {
    return forbidden();
  }

  const result = await chatDao.listSupportMessages(supabase, {
    userId: guard.user.id,
    role: guard.user.role,
    supportType,
    before: before ?? null,
    after: after ?? null,
    limit,
    filterUserId: filterUserId ?? null,
  });

  return NextResponse.json({
    messages: result.messages,
    nextCursor: result.nextCursor,
    session_active: result.sessionActive,
    session: result.session
      ? {
          id: result.session.id,
          status: result.session.status,
          case_number: result.session.case_number,
          assigned_to: result.session.assigned_to,
          assigned_staff_name: result.session.ASSIGNED?.full_name ?? null,
        }
      : null,
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();

  const guard = await requireRole();
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  if (!hasMinRole(guard.user.role, ROLES.ADMIN) && guard.user.role !== ROLES.ATTENDEE) {
    return forbidden();
  }

  if (await rateLimitCheck(supabase, guard.user.id)) {
    return NextResponse.json({ error: "Too many messages. Please slow down." }, { status: 429 });
  }

  try {
    const session = await openOrReuseSession(supabase, {
      userId: guard.user.id,
      role: guard.user.role,
      recipientUserId: parsed.data.recipient_user_id,
    });

    const message = await sendSupportMessage(supabase, {
      message: parsed.data.message,
      sessionId: session.id,
      userId: guard.user.id,
      role: guard.user.role,
      recipientUserId: parsed.data.recipient_user_id,
    });

    return NextResponse.json(message, { status: 201 });
  } catch (err) {
    return mapError(err);
  }
}
