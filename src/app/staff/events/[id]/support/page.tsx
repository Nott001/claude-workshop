"use client";

import { useParams } from "next/navigation";
import { useSession } from "@/modules/auth/components/session-context";
import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import ChatPanel from "@/modules/chat/components/chat-panel";

export default function StaffSupportPage() {
  const params = useParams();
  const eventId = params.id as string;
  const { user } = useSession();
  const { role, allowed, pending } = useRoleGuard("facilitator");
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
        <h1>Event Support Chat</h1>
        <p>Use this channel to communicate with event attendees.</p>
        <ChatPanel eventId={eventId} supportType="event" userRole={role} currentUserId={currentUserId} />
      </div>
    </>
  );
}
