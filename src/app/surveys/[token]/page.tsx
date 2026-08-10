"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SurveyForm } from "@/modules/surveys/components/survey-form";

type SurveyState = { state: "open"; event_title: string } | { state: "submitted" } | { state: "expired" } | null;

export default function SurveyPage() {
  const { token } = useParams<{ token: string }>();
  const [survey, setSurvey] = useState<SurveyState | "loading">("loading");

  useEffect(() => {
    fetch(`/api/surveys/${token}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setSurvey(data))
      .catch(() => setSurvey(null));
  }, [token]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-bg px-5 py-16">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-8 shadow-[0_4px_20px_0_rgba(0,0,0,0.05)]">
        {survey === "loading" ? (
          <div className="flex items-center justify-center py-12">
            <span className="material-symbols-rounded animate-spin text-4xl text-brand">progress_activity</span>
          </div>
        ) : survey?.state === "open" ? (
          <SurveyForm eventTitle={survey.event_title} token={token} />
        ) : survey?.state === "submitted" ? (
          <div className="text-center">
            <span className="material-symbols-rounded text-5xl text-info">how_to_reg</span>
            <h1 className="mt-4 text-2xl font-bold text-fg">Already submitted</h1>
            <p className="mt-2 text-sm text-muted-fg">You have already sent your feedback for this event.</p>
          </div>
        ) : survey?.state === "expired" ? (
          <div className="text-center">
            <span className="material-symbols-rounded text-5xl text-warning">schedule</span>
            <h1 className="mt-4 text-2xl font-bold text-fg">This link has expired</h1>
            <p className="mt-2 text-sm text-muted-fg">Surveys close 14 days after they are sent.</p>
          </div>
        ) : (
          <div className="text-center">
            <span className="material-symbols-rounded text-5xl text-muted-fg">link_off</span>
            <h1 className="mt-4 text-2xl font-bold text-fg">Survey not found</h1>
            <p className="mt-2 text-sm text-muted-fg">This link is not valid.</p>
          </div>
        )}
      </div>
    </div>
  );
}
