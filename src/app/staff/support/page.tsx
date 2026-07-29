import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import { chatDao } from "@/shared/db/dao";
import { SupportChatClient } from "@/modules/support/components/support-chat-client";

export default async function StaffSupportPage() {
  const supabase = getServiceClient();
  const user = await requireAuth(supabase);

  const result = user
    ? await chatDao.listSupportMessages(supabase, {
        userId: user.id,
        role: user.role,
        before: null,
        after: null,
        limit: 50,
        filterUserId: null,
      })
    : { messages: [], nextCursor: null, sessionActive: false };

  return <SupportChatClient messages={result.messages} currentUserId={user?.id ?? null} />;
}
