import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import * as chatDao from "@/shared/db/dao/chat.dao";
import { sendMessageSchema, supportTypeEnum } from "@/modules/chat/lib/schemas";
import { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX } from "@/modules/chat/lib/rate-limit";
import { hasMinRole } from "@/shared/lib/role-hierarchy";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const before = searchParams.get("before");
  const after = searchParams.get("after");
  const filterUserId = searchParams.get("user_id");
  const supportTypeParam = searchParams.get("support_type") ?? "general";
  const eventIdParam = searchParams.get("event_id");
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 50);

  const parsedType = supportTypeEnum.safeParse(supportTypeParam);
  if (!parsedType.success) {
    return NextResponse.json({ error: "Invalid support_type" }, { status: 400 });
  }
  const supportType = parsedType.data;
  const eventId = eventIdParam ? Number(eventIdParam) : null;

  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (supportType === "general" && !hasMinRole(user.role, ROLES.ADMIN) && user.role !== ROLES.ATTENDEE) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await chatDao.listSupportMessages(supabase, {
    userId: user.id,
    role: user.role,
    supportType,
    eventId,
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

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const supportType = parsed.data.support_type ?? "general";

  if (supportType === "general" && !hasMinRole(user.role, ROLES.ADMIN) && user.role !== ROLES.ATTENDEE) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isStaff = hasMinRole(user.role, supportType === "general" ? ROLES.ADMIN : ROLES.FACILITATOR);

  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

  const [rateLimitCount] = await Promise.all([chatDao.countRecentByUser(supabase, user.id, supportType, windowStart)]);

  if (rateLimitCount >= RATE_LIMIT_MAX) {
    return NextResponse.json({ error: "Too many messages. Please slow down." }, { status: 429 });
  }

  let sessionId: number;

  if (supportType === "general" && isStaff && parsed.data.recipient_user_id) {
    // A staff reply lands in the asker's active case, and only the handler
    // assigned to that case may send it — otherwise two admins talk at once.
    const active = await chatDao.findActiveSession(supabase, parsed.data.recipient_user_id, "general");
    if (!active) {
      return NextResponse.json({ error: "No active case for this user" }, { status: 404 });
    }
    if (active.assigned_to === null) {
      return NextResponse.json({ error: "Claim this case before replying" }, { status: 409 });
    }
    if (active.assigned_to !== user.id) {
      return NextResponse.json({ error: "This case is being handled by another staff member" }, { status: 403 });
    }
    sessionId = active.id;
  } else {
    const sessionUserId = isStaff && parsed.data.recipient_user_id ? parsed.data.recipient_user_id : user.id;

    const existing = await chatDao.findActiveSession(supabase, sessionUserId, supportType);

    if (existing) {
      sessionId = existing.id;
    } else {
      const newSession = await chatDao.createSession(supabase, sessionUserId, supportType);
      // createSession returns null on failure; asserting non-null turned an
      // insert error into a TypeError and a 500 with no usable message.
      if (!newSession) {
        return NextResponse.json({ error: "Failed to start a support session" }, { status: 500 });
      }
      sessionId = newSession.id;
    }
  }

  const message = await chatDao.sendMessage(supabase, {
    support_type: supportType,
    user_id: user.id,
    message: parsed.data.message,
    session_id: sessionId,
    recipient_user_id: isStaff && parsed.data.recipient_user_id ? parsed.data.recipient_user_id : undefined,
  });

  if (!message) {
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }

  return NextResponse.json(message, { status: 201 });
}
