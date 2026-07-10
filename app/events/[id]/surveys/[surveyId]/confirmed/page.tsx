"use client";

import { useParams, useRouter } from "next/navigation";

export default function ConfirmedPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  return (
    <div>
      <h1>Survey Submitted</h1>
      <p>Your responses have been recorded. Thank you for your feedback!</p>
      <button onClick={() => router.push(`/events/${eventId}/surveys`)}>Back to Surveys</button>
    </div>
  );
}
