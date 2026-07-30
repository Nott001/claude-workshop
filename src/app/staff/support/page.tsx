"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/modules/auth";
import ChatPanel from "@/modules/chat/components/chat-panel";
import { Footer } from "@/shared/components/footer";
import { hasMinRole } from "@/shared/lib/role-hierarchy";

export default function StaffSupportPage() {
  const router = useRouter();
  const { user } = useSession();
  const userRole = user?.role ?? null;
  const currentUserId = user?.id ?? null;

  useEffect(() => {
    if (!hasMinRole(userRole, "admin")) {
      router.replace("/access-denied");
    }
  }, [userRole, router]);

  if (!hasMinRole(userRole, "admin")) return null;

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
