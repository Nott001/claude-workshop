"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import ChatPanel from "@/components/chat-panel";
import type { UserRole } from "@/types";
import { Footer } from "@/components/footer";

export default function SupportPage() {
  const params = useParams();
  const eventId = params.id as string;
  const { isLoaded, isSignedIn } = useUser();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setUserRole(data.role);
        setCurrentUserId(data.user_id);
        setLoading(false);
      });
  }, [isLoaded, isSignedIn]);

  if (loading) return <div>Loading...</div>;

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
