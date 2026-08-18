import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireMinRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import { communityLinkPartialSchema } from "@/modules/community/lib/community-schemas";
import { CommunityServiceError, deleteCommunityLink, updateCommunityLink } from "@/modules/community/lib/community-service";
import { badRequest } from "@/shared/lib/api-response";

function mapError(err: unknown): NextResponse {
  if (err instanceof CommunityServiceError) {
    if (err.status === 404) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  throw err;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requireMinRole(ROLES.ADMIN);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const body = await req.json();
  const parsed = communityLinkPartialSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error);
  }

  const supabase = getServiceClient();

  try {
    const link = await updateCommunityLink(supabase, Number(id), parsed.data);
    return NextResponse.json(link);
  } catch (err) {
    return mapError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requireMinRole(ROLES.ADMIN);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const supabase = getServiceClient();

  try {
    await deleteCommunityLink(supabase, Number(id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mapError(err);
  }
}
