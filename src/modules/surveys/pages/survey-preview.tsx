"use client";

import { ROLES } from "@/shared/lib/roles";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import { SurveyForm } from "@/modules/surveys/components/survey-form";
import type { Event } from "@/shared/types";
import { BackLink } from "@/shared/components/back-link";

export function SurveyPreviewPage() {
  const params = useParams();
  const eventId = params.id as string;
  const { pending, allowed } = useRoleGuard(ROLES.ADMIN);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!allowed) return;
    fetch(`/api/events/${eventId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setEvent(data ?? null))
      .catch(() => setEvent(null))
      .finally(() => setLoading(false));
  }, [allowed, eventId]);

  if (pending || loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <span className="material-symbols-rounded animate-spin text-4xl text-brand">progress_activity</span>
      </div>
    );
  }

  if (!allowed) return null;

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <div className="mx-auto w-full max-w-2xl px-5 py-12 sm:px-8">
        <BackLink href={`/staff/events/${eventId}`} className="mb-6">
          Back to event
        </BackLink>

        <div className="rounded-xl border border-border bg-surface p-8 shadow-[0_4px_20px_0_rgba(0,0,0,0.05)]">
          <div className="mb-6 border-b border-border pb-4">
            <h1 className="text-2xl font-bold text-fg">Survey preview</h1>
            <p className="mt-1 text-sm text-muted-fg">This is how the survey looks to attendees. Submissions are disabled.</p>
          </div>
          {event ? <SurveyForm eventTitle={event.title} readOnly /> : <p className="text-sm text-error">Event not found.</p>}
        </div>
      </div>
    </div>
  );
}
