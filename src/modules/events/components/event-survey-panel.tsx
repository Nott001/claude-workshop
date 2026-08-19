"use client";

import Link from "next/link";
import { useState } from "react";
import { apiErrorMessage } from "@/shared/lib/api-error-message";
import { parseLocalDateTime } from "@/shared/lib/date-utils";
import { Button, buttonStyles } from "@/shared/components/button";
import { SectionCard, StatGrid } from "@/shared/components/section-card";
import { useSurveyStatus } from "@/modules/surveys/lib/use-survey-status";
import { cn } from "@/shared/lib/utils";

interface SurveyEvent {
  id: number;
  event_date: string;
  end_time: string;
  survey_enabled: boolean;
}

function RatingBars({ counts }: { counts: number[] }) {
  const max = Math.max(...counts);

  return (
    <div className="space-y-1.5">
      {[5, 4, 3, 2, 1].map((star) => {
        const count = counts[star - 1];
        return (
          <div key={star} className="flex items-center gap-2 text-xs text-muted-fg">
            <span className="w-3 text-fg">{star}</span>
            <span aria-hidden className="material-symbols-rounded text-[14px] text-amber-400">
              star
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-brand" style={{ width: `${max > 0 ? (count / max) * 100 : 0}%` }} />
            </div>
            <span className="w-5 text-right">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

export function EventSurveyPanel({ event, onSaved }: { event: SurveyEvent; onSaved?: (surveyEnabled: boolean) => void }) {
  const eventId = String(event.id);
  const [enabled, setEnabled] = useState(event.survey_enabled);
  const { status, loading, error, mutate } = useSurveyStatus(eventId, enabled);
  const [saving, setSaving] = useState(false);
  const [settingError, setSettingError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState<string | null>(null);

  // enabled is mutated only by the toggle below; the server value may drift if
  // another staff member changed it, but a reload resets it via useState.
  const eventEnd = parseLocalDateTime(event.event_date, event.end_time);
  const finished = eventEnd != null && eventEnd <= new Date();

  async function handleToggle(next: boolean) {
    setSaving(true);
    setSettingError(null);
    const res = await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ survey_enabled: next }),
    });
    if (!res.ok) {
      const body = await res.json();
      setSettingError(apiErrorMessage(body, "Failed to update survey setting"));
      setSaving(false);
      return;
    }
    setEnabled(next);
    onSaved?.(next);
    setSaving(false);
  }

  // The send runs a batch per request, because each recipient costs a full SMTP
  // session and a whole list does not fit in one. Looping here keeps the
  // progress in front of whoever pressed the button, and every batch is
  // independently durable: a response is only taken off the queue once its mail
  // is actually away, so closing the tab halfway loses nothing but the rest of
  // the run, which the next press resumes.
  async function handleSend() {
    setSending(true);
    setSendMessage(null);
    setSettingError(null);

    let delivered = 0;
    let failed = 0;

    for (;;) {
      const res = await fetch(`/api/events/${eventId}/survey/send`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json();
        setSettingError(body.error ?? "Failed to send survey");
        setSending(false);
        mutate();
        return;
      }

      const result = await res.json();
      delivered += result.delivered;
      failed += result.failed;

      if (result.remaining === 0) break;

      // A batch that delivered nothing has not moved the queue: a response is
      // only taken off it once its mail is away, so the next call would be
      // handed the same recipients and `remaining` would never fall. That is
      // the mail path being down rather than one address being bad, and
      // looping on it would reopen connections until the tab is closed.
      if (result.delivered === 0) {
        setSendMessage(`Delivered ${delivered}; the rest could not be sent. Try again once mail is working.`);
        setSending(false);
        mutate();
        return;
      }

      setSendMessage(`Sending… ${delivered} delivered, ${result.remaining} to go.`);
    }

    if (failed > 0) {
      setSendMessage(`Delivered ${delivered} of ${delivered + failed}; the rest will be retried on the next send.`);
    } else {
      setSendMessage(`Survey emailed to ${delivered} attendee${delivered === 1 ? "" : "s"}.`);
    }
    setSending(false);
    mutate();
  }

  // Fully delivered means every response already has an email out; re-sending
  // would just spam people who already hold the link.
  const surveyExpired = !!status?.survey && status.survey.expired;
  const surveyComplete = !!status?.survey && !surveyExpired && status.survey.undelivered_count === 0;
  const sendDisabled = sending || surveyComplete || surveyExpired;
  const respondedCount = status?.results.counts.reduce((sum, count) => sum + count, 0) ?? 0;

  return (
    <SectionCard title="Surveys" icon="poll">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted p-3">
        <div>
          <p className="text-sm font-medium text-fg">Opt-in to post-event survey</p>
          <p className="text-xs text-muted-fg">Turning this on only enables the form — no email goes out until you send it.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-semibold", enabled ? "text-fg" : "text-muted-fg")}>{enabled ? "On" : "Off"}</span>
          <button
            onClick={() => handleToggle(!enabled)}
            disabled={saving}
            role="switch"
            aria-checked={enabled}
            aria-label="Enable post-event survey"
            className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-50 ${enabled ? "bg-brand" : "bg-border"}`}
          >
            <span
              className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`}
            />
          </button>
        </div>
      </div>

      {settingError && <p className="mb-3 text-sm text-error">{settingError}</p>}
      {error && <p className="mb-3 text-sm text-error">{error}</p>}

      {enabled && loading && <p className="text-sm text-muted-fg">Loading survey...</p>}

      {enabled && !loading && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button onClick={handleSend} disabled={sendDisabled || !finished}>
              {sending
                ? "Sending..."
                : !finished
                  ? "Locked until event ends"
                  : status?.survey && status.survey.undelivered_count > 0
                    ? "Retry send"
                    : "Send bulk survey"}
            </Button>
            <Link href={`/staff/events/${eventId}/survey-preview`} className={buttonStyles({ variant: "secondary" })}>
              Preview form
            </Link>
          </div>

          {surveyExpired && !sending && (
            <p className="mb-3 text-xs text-muted-fg">The 14-day window has passed, so the survey can no longer be emailed.</p>
          )}
          {surveyComplete && !sending && (
            <p className="mb-3 text-xs text-success">Survey emailed to every registered attendee.</p>
          )}
          {sendMessage && <p className="mb-3 text-xs text-success">{sendMessage}</p>}

          {status?.survey ? (
            <div className="space-y-4">
              <StatGrid
                stats={[
                  { label: "Recipients", value: status.survey.total_recipients },
                  { label: "Responded", value: respondedCount },
                  { label: "Average", value: status.results.average ?? "—" },
                ]}
              />

              {status.survey.undelivered_count > 0 && !status.survey.expired && (
                <p className="text-xs text-muted-fg">
                  {status.survey.undelivered_count} email{status.survey.undelivered_count === 1 ? "" : "s"} not yet delivered
                  &mdash; use &ldquo;Retry send&rdquo;.
                </p>
              )}

              {status.results.counts.some((count) => count > 0) && <RatingBars counts={status.results.counts} />}

              {status.results.comments.length > 0 && (
                <ul className="space-y-2">
                  {status.results.comments.map((comment, i) => (
                    <li key={i} className="rounded-lg border border-border bg-muted p-3">
                      <div className="flex items-center gap-2">
                        <span aria-hidden className="material-symbols-rounded text-[14px] text-amber-400">
                          star
                        </span>
                        <span className="text-xs font-semibold text-fg">{comment.rating}</span>
                        {comment.attendee_name && <span className="text-xs text-muted-fg">{comment.attendee_name}</span>}
                      </div>
                      <p className="mt-1 text-sm text-fg">{comment.comment}</p>
                    </li>
                  ))}
                </ul>
              )}

              {respondedCount === 0 && <p className="text-xs text-muted-fg">No responses yet.</p>}
            </div>
          ) : (
            <p className="text-xs text-muted-fg">
              {finished
                ? "Send the survey to email it to every registered attendee."
                : "Surveys can be sent once the event has ended."}
            </p>
          )}
        </>
      )}
    </SectionCard>
  );
}
