import type { UserRole } from "@/shared/types";
import { endCase } from "@/modules/chat/lib/support-service";
import * as chatDao from "@/shared/db/dao/chat.dao";
import { deleteByUser as deleteTicketRows } from "@/shared/db/dao/ticket.dao";
import { deleteByUser as deleteQaRows } from "@/modules/courses/qa/db/qa-message.dao";
import { deleteResponsesByUser } from "@/modules/surveys/db/survey.dao";
import { deleteByUser as deleteEmailLogRows } from "@/shared/db/dao/email.dao";
import { deleteByEmail } from "@/shared/db/dao/password-reset.dao";
import { deleteByUser as deleteEmailChangeAttempts } from "@/shared/db/dao/email-change-attempt.dao";
import { removeByUserId } from "@/shared/db/dao/speaker.dao";
import { updateUser } from "@/shared/db/dao/user.dao";
import { getServiceClient } from "@/shared/db/client";
import { deleteFromStorage, listStorageFolder } from "@/shared/integrations/storage/service";

export interface DeleteAccountInput {
  userId: number; // USER.id (numeric app row)
  authUserId: string; // auth.users.id (from getCurrentUserId)
  email: string; // the live address, needed before it is anonymized
  role: UserRole; // passed through to endCase's actor
}

/**
 * Removes every row the account owns, then anonymizes the USER row and deletes
 * the Supabase auth identity. The purges run first and throw on failure so a
 * partial purge aborts before the irreversible steps; the one storage cleanup
 * is best-effort (a leftover profile image is not a privacy leak worth
 * blocking the deletion over). An identity that is already gone counts as
 * deleted — the rows and profile are what the teardown is for.
 */
export async function deleteAccount(input: DeleteAccountInput): Promise<void> {
  const supabase = getServiceClient();

  // Inert when there is no active case; the notice it writes is removed by the
  // message purge that follows.
  await endCase(supabase, input.userId, { id: input.userId, role: input.role });

  if (!(await chatDao.deleteMessagesByUser(supabase, input.userId))) {
    throw new Error("Failed to delete chat messages sent by the user");
  }
  if (!(await chatDao.deleteMessagesByRecipient(supabase, input.userId))) {
    throw new Error("Failed to delete chat messages received by the user");
  }
  if (!(await deleteTicketRows(supabase, input.userId))) {
    throw new Error("Failed to delete the user's ticket rows");
  }
  if (!(await deleteQaRows(supabase, input.userId))) {
    throw new Error("Failed to delete the user's QA messages");
  }
  if (!(await deleteResponsesByUser(supabase, input.userId))) {
    throw new Error("Failed to delete the user's survey responses");
  }
  if (!(await deleteEmailLogRows(supabase, input.userId))) {
    throw new Error("Failed to delete the user's email log rows");
  }
  // The raw address is read from input; unlike user-id-keyed tables the
  // attempt rows only carry the string, so this must run before anonymization.
  if (!(await deleteByEmail(supabase, input.email))) {
    throw new Error("Failed to delete the user's password-reset attempts");
  }
  // Keyed on the user id rather than the address, but the same reasoning: the
  // rows outlive their rate-limit window and tie an account to an IP, and no
  // foreign key removes them on the account's behalf.
  if (!(await deleteEmailChangeAttempts(supabase, input.userId))) {
    throw new Error("Failed to delete the user's email-change attempts");
  }
  // Harmless when the user is not a speaker; cascades EVENT_SPEAKER and nulls
  // MODULE.speaker_profile_id.
  if (!(await removeByUserId(supabase, input.userId))) {
    throw new Error("Failed to delete the user's speaker profile");
  }

  try {
    const paths = await listStorageFolder("profile_images", `users/${input.userId}`);
    await deleteFromStorage("profile_images", paths);
  } catch {
    // Best-effort like every other storage deletion; never blocks account teardown.
  }

  // The row must reach its final state before the identity leaves, so a failed
  // write aborts here rather than stranding a live account under a tombstone.
  const tombstone = await updateUser(supabase, input.authUserId, {
    full_name: "Deleted User",
    email: `deleted-${input.userId}@deleted.local`,
    profile_image_url: null,
  });
  if (!tombstone) {
    throw new Error("Failed to anonymize the user's profile row");
  }

  // The identity may already be gone: rosters include accounts that never had an
  // auth row, and a gone identity is the end state a finished teardown leaves.
  // Same "not found is success" tolerance the reset link applies, so deleting
  // such an account is not reported as a failure on its last step.
  const { error } = await supabase.auth.admin.deleteUser(input.authUserId);
  if (error && !isUnknownIdentity(error)) {
    throw new Error(`Failed to delete the auth account: ${error.message}`);
  }
}

/** GoTrue answers an identity that is already gone with a 404 / "User not found". */
function isUnknownIdentity(error: { status?: number; message?: string }): boolean {
  return error.status === 404 || /user not found/i.test(error.message ?? "");
}
