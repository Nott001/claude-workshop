"use client";

import { useParams } from "next/navigation";
import { useSession } from "@/modules/auth";
import ChatPanel from "@/modules/chat/components/chat-panel";
import type { UserRole } from "@/shared/types";
import { Footer } from "@/shared/components/footer";

export default function SupportPage() {
  const params = useParams();
  const eventId = params.id as string;
  const { user } = useSession();
  const userRole = (user?.role as UserRole) ?? null;
  const currentUserId = user?.id ?? null;

  return (
    <>
      <div>
        <h1>Support Chat</h1>
        <p>Use this channel to ask facilitators for help with event logistics.</p>
        <ChatPanel eventId={eventId} channel="support" userRole={userRole} currentUserId={currentUserId} />
      </div>
      <Footer role="facilitator" />
    </>
  );
}
