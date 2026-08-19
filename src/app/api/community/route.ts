import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/lib/session";
import { requireMinRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import { toErrorResponse } from "@/shared/lib/error-response";
import { communityLinkSchema } from "@/modules/community/lib/community-schemas";
import { createCommunityLink, listCommunityLinks } from "@/modules/community/lib/community-service";
import { badRequest } from "@/shared/lib/api-response";

export async function GET(_req: Request) {
  const supabase = getServiceClient();
  // Public read: an anonymous caller simply has no staff role, so the service
  // answers visible cards only. No guard is needed beyond resolving the role.
  const user = await getCurrentUser(supabase);
  const links = await listCommunityLinks(supabase, user?.role ?? null);
  return NextResponse.json(links);
}

export async function POST(req: Request) {
  const guard = await requireMinRole(ROLES.ADMIN);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const body = await req.json();
  const parsed = communityLinkSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error);
  }

  const supabase = getServiceClient();

  try {
    const link = await createCommunityLink(supabase, parsed.data, { id: guard.user.id });
    return NextResponse.json(link, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
