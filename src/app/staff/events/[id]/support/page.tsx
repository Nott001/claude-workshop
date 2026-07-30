"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/modules/auth";
import ChatPanel from "@/modules/chat/components/chat-panel";
import type { UserRole } from "@/shared/types";
import { Footer } from "@/shared/components/footer";
import { hasMinRole } from "@/shared/lib/role-hierarchy";

export default function StaffSupportPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;
  const { user } = useSession();
  const userRole = (user?.role as UserRole) ?? null;
  const currentUserId = user?.id ?? null;

  useEffect(() => {
    if (!hasMinRole(userRole, "facilitator")) {
      router.replace("/access-denied");
    }
  }, [userRole, router]);

  if (!hasMinRole(userRole, "facilitator")) return null;

  return (
    <>
      <div>
        <h1>Event Support Chat</h1>
        <p>Use this channel to communicate with event attendees.</p>
        <ChatPanel eventId={eventId} supportType="event" userRole={userRole} currentUserId={currentUserId} />
      </div>
      <Footer role={user?.role as "facilitator" | "speaker" | "attendee"} />
    </>
  );
}
