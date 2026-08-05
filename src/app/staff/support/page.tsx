"use client";

import { useSession } from "@/modules/auth/components/session-context";
import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import ChatPanel from "@/modules/chat/components/chat-panel";
import { Footer } from "@/shared/components/footer";

export default function StaffSupportPage() {
  const { user } = useSession();
  const { role, allowed, pending } = useRoleGuard("admin");
  const currentUserId = user?.id ?? null;

  if (pending) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-fg">Loading...</div>
      </div>
    );
  }

  if (!allowed) return null;

  return (
    <>
      <div>
        <h1>General Support Inbox</h1>
        <p>Handle general support requests from attendees.</p>
        <ChatPanel eventId="" supportType="general" userRole={role} currentUserId={currentUserId} />
      </div>
      <Footer role={user?.role as "facilitator" | "speaker" | "attendee"} />
    </>
  );
}
