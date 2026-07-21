"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";

interface Survey {
  survey_id: number;
  title: string;
  already_submitted?: boolean;
}

export default function SurveyListPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const { user: authUser } = useCurrentUser();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);

  const userRole = authUser?.role ?? null;

  useEffect(() => {
    if (!authUser) return;
    fetch(`/api/events/${eventId}/surveys`)
      .then((r) => r.json())
      .then((data) => {
        setSurveys(data);
        setLoading(false);
      });
  }, [eventId, authUser]);

  if (loading) return <div>Loading...</div>;

  const isFacilitator = userRole === "facilitator";

  return (
    <div>
      <h1>Surveys</h1>
      {isFacilitator && <button onClick={() => router.push(`/events/${eventId}/surveys/new`)}>Create Survey</button>}

      {surveys.length === 0 ? (
        <p>No surveys yet.</p>
      ) : (
        <ul>
          {surveys.map((s) => (
            <li key={s.survey_id}>
              <strong>{s.title}</strong>
              {isFacilitator ? (
                <div>
                  <button onClick={() => router.push(`/events/${eventId}/surveys/${s.survey_id}/edit`)}>Edit</button>
                  <button onClick={() => router.push(`/events/${eventId}/surveys/${s.survey_id}/responses`)}>Responses</button>
                </div>
              ) : s.already_submitted ? (
                <p>Already submitted</p>
              ) : (
                <button onClick={() => router.push(`/events/${eventId}/surveys/${s.survey_id}`)}>Take Survey</button>
              )}
            </li>
          ))}
        </ul>
      )}

      <button onClick={() => router.push(`/events/${eventId}`)}>&larr; Back to Event</button>
    </div>
  );
}
