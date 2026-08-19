import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireMinRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import { badRequest } from "@/shared/lib/api-response";
import { canManageEvent } from "@/modules/courses/lib/course-access";
import { readAfterEventModules } from "@/modules/courses/lib/course-entitlement";
import { AFTER_EVENT_MODULES_SETTING_KEY, releaseFor, withRelease } from "@/modules/courses/lib/after-event-modules";
import { afterEventModulesSchema as releaseBodySchema } from "@/modules/courses/lib/schemas";
import { setSetting } from "@/shared/db/dao/system-setting.dao";
import { requireAuditEvent } from "@/modules/audit/lib/log-audit-event";
import * as courseDao from "@/shared/db/dao/course.dao";

/** A Q&A module holds no material and its realtime read is keyed to a live
 * ticket, so releasing one afterwards would offer an empty, silent panel. */
const releasable = (mod: courseDao.ModuleChoice) => mod.module_type !== "qa";

/**
 * Which of this event's own modules are held back until it ends, and the
 * modules it could hold back.
 *
 * Both halves in one response because the editor renders a single checklist,
 * and asking twice would have the list briefly disagree with the selection.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireMinRole(ROLES.FACILITATOR);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { id } = await params;
  const eventId = Number(id);
  const supabase = getServiceClient();

  if (!(await canManageEvent(supabase, guard.user.id, guard.user.role, eventId))) {
    return NextResponse.json({ error: "You are not assigned to this event" }, { status: 403 });
  }

  const [map, modules] = await Promise.all([readAfterEventModules(supabase), courseDao.listModulesByEvent(supabase, eventId)]);

  return NextResponse.json({
    module_ids: releaseFor(map, eventId),
    modules: modules.filter(releasable),
  });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireMinRole(ROLES.FACILITATOR);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { id } = await params;
  const eventId = Number(id);
  const supabase = getServiceClient();

  if (!(await canManageEvent(supabase, guard.user.id, guard.user.role, eventId))) {
    return NextResponse.json({ error: "You are not assigned to this event" }, { status: 403 });
  }

  const parsed = releaseBodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return badRequest(parsed.error);
  }

  // Only this event's own curriculum may be held back by it: a module id from
  // somewhere else would sit in the map releasing material this event does not
  // own, on a clock that has nothing to do with it.
  const own = new Set((await courseDao.listModulesByEvent(supabase, eventId)).filter(releasable).map((mod) => mod.id));
  if (parsed.data.module_ids.some((moduleId) => !own.has(moduleId))) {
    return NextResponse.json({ error: "Those modules do not belong to this event's course" }, { status: 400 });
  }

  // Read-modify-write of one settings row: two staff saving different events
  // at the same instant leaves the later save's map in place. The releases are
  // edited rarely and by few people, so a lock is not worth the moving parts.
  const map = await readAfterEventModules(supabase);

  if (
    !(await setSetting(
      supabase,
      AFTER_EVENT_MODULES_SETTING_KEY,
      withRelease(map, eventId, parsed.data.module_ids),
      guard.user.id,
    ))
  ) {
    return NextResponse.json({ error: "Failed to save the release" }, { status: 500 });
  }

  // No audit action names a release, and the enum is a database type: this
  // changes what the event gives its attendees, so it is recorded as one.
  await requireAuditEvent(supabase, guard.user.id, "event.updated", "event", eventId, {
    after_event_module_ids: parsed.data.module_ids,
  });

  return NextResponse.json({ module_ids: parsed.data.module_ids });
}
