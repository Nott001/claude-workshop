"use client";

import { useSession } from "@/modules/auth";
import ChatPanel from "@/modules/chat/components/chat-panel";
import { Footer } from "@/shared/components/footer";
import { hasMinRole } from "@/shared/lib/role-hierarchy";

export default function StaffSupportPage() {
  const { user } = useSession();
  const userRole = user?.role ?? null;
  const currentUserId = user?.id ?? null;

  if (!hasMinRole(userRole, "admin")) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-error">Access denied.</div>
      </div>
    );
  }

  return (
    <>
      <div>
        <h1>General Support Inbox</h1>
        <p>Handle general support requests from attendees.</p>
        <ChatPanel eventId="" supportType="general" userRole={userRole} currentUserId={currentUserId} />
      </div>
      <Footer role={user?.role as "facilitator" | "speaker" | "attendee"} />
    </>
  );
}
