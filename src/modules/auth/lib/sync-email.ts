import { getServiceClient } from "@/shared/db/client";
import * as userDao from "@/shared/db/dao/user.dao";
import { isSameEmail } from "@/shared/lib/email";

/**
 * Brings the app's USER row level with the address Supabase has confirmed.
 *
 * The row cannot be written when the change is requested. Until the link is
 * opened the new address is only a claim: Supabase holds it aside as a pending
 * change and keeps signing the account in under the old one. Writing it early
 * shows every surface that reads USER an identity the account does not own,
 * and leaves the row permanently wrong when the link is never opened.
 * Confirmation is the first moment the two are known to agree, so that is
 * where the copy belongs.
 *
 * Runs for every confirmed exchange rather than only for email changes, so a
 * row that drifted before this existed is repaired the next time its owner
 * follows any link.
 */
export async function syncEmailFromAuth(authUserId?: string | null, email?: string | null): Promise<void> {
  if (!authUserId || !email) return;

  const supabase = getServiceClient();
  const user = await userDao.findByAuthId(supabase, authUserId);

  // No row yet means this is a first sign-in, and ensureUser is about to
  // create one from the same auth record — already carrying this address.
  if (!user || isSameEmail(user.email, email)) return;

  await userDao.updateUser(supabase, authUserId, { email });
}
