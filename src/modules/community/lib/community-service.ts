import { ROLES } from "@/shared/lib/roles";
import type { DbClient } from "@/shared/db/dao/types";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import type { UserRole } from "@/shared/types";
import type { CommunityLink } from "@/shared/types";
import type { CommunityLinkInput, CommunityLinkPatch } from "@/modules/community/lib/community-schemas";
import { CommunityServiceError } from "@/modules/community/lib/community-errors";
import * as communityDao from "@/modules/community/db/community.dao";

export { CommunityServiceError } from "@/modules/community/lib/community-errors";

export type CommunityActor = { id: number };

export function isStaffRole(role: UserRole | null): boolean {
  return hasMinRole(role, ROLES.ADMIN);
}

/** Admins and superadmins see every card (hidden included); everyone else visible cards only. */
export async function listCommunityLinks(supabase: DbClient, role: UserRole | null): Promise<CommunityLink[]> {
  return communityDao.list(supabase, isStaffRole(role));
}

export async function createCommunityLink(
  supabase: DbClient,
  input: CommunityLinkInput,
  actor: CommunityActor,
): Promise<CommunityLink> {
  // New cards land after every existing one unless the caller pinned an order.
  const sequenceOrder = input.sequence_order ?? (await communityDao.getMaxSequenceOrder(supabase)) + 1;

  const link = await communityDao.create(
    supabase,
    {
      label: input.label,
      url: input.url,
      description: input.description ?? null,
      icon_url: input.icon_url ?? null,
      sequence_order: sequenceOrder,
    },
    actor.id,
  );

  if (!link) {
    throw new CommunityServiceError(500, "Failed to create community link");
  }

  return link;
}

export async function updateCommunityLink(supabase: DbClient, id: number, input: CommunityLinkPatch): Promise<CommunityLink> {
  const existing = await communityDao.findById(supabase, id);
  if (!existing) {
    throw new CommunityServiceError(404, "Community link not found");
  }

  const link = await communityDao.update(supabase, id, {
    ...(input.label !== undefined && { label: input.label }),
    ...(input.url !== undefined && { url: input.url }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.icon_url !== undefined && { icon_url: input.icon_url }),
    ...(input.sequence_order !== undefined && { sequence_order: input.sequence_order }),
    ...(input.is_hidden !== undefined && { is_hidden: input.is_hidden }),
  });

  if (!link) {
    throw new CommunityServiceError(500, "Failed to update community link");
  }

  return link;
}

export async function deleteCommunityLink(supabase: DbClient, id: number): Promise<{ success: true }> {
  const existing = await communityDao.findById(supabase, id);
  if (!existing) {
    throw new CommunityServiceError(404, "Community link not found");
  }

  const removed = await communityDao.remove(supabase, id);
  if (!removed) {
    throw new CommunityServiceError(500, "Failed to delete community link");
  }

  return { success: true };
}
