"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function SpeakerLiveRedirect() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  useEffect(() => {
    router.replace(`/events/${eventId}/room`);
  }, [eventId, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fbf9f8]">
      <div className="text-sm text-[#5f5e5e]">Redirecting to event room...</div>
    </div>
  );
}
