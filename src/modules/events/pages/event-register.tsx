"use client";

import { useParams, useRouter } from "next/navigation";

import { formatEventDate, formatTime } from "@/shared/lib/date-utils";
import { toBackLinkOrigin, withBackLink } from "@/shared/lib/back-link";
import { useEventRegistration } from "@/modules/events/lib/use-event-registration";
import { BackLink } from "@/shared/components/back-link";

export function EventRegisterPage({ from }: { from?: string }) {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const { data, loading, agreed, setAgreed, submitting, error, handleRegister } = useEventRegistration(eventId);
  // Relayed, not resolved: this page always returns to the event, and the event
  // is what needs to know where the reader came in from two hops ago.
  const eventHref = withBackLink(`/events/${eventId}`, toBackLinkOrigin(from));

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-fg">Loading...</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-error">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-error">Not found</div>
      </div>
    );
  }

  if (data.already_registered) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="mx-auto max-w-sm text-center">
          <span className="material-symbols-rounded text-4xl text-info">confirmation_number</span>
          <h1 className="mt-4 text-lg font-bold text-fg">Already Registered</h1>
          <p className="mt-2 text-sm text-muted-fg">
            You already have a ticket for <strong className="text-fg">{data.event.title}</strong>.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => router.push("/tickets")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-fg transition-colors hover:bg-brand/90"
            >
              <span className="material-symbols-rounded text-sm">confirmation_number</span>
              View my tickets
            </button>
            <button
              onClick={() => router.push(eventHref)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-fg transition-colors hover:bg-muted"
            >
              Back to event
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-1 flex-col p-6 sm:p-8">
        <div className="mx-auto w-full max-w-lg">
          <BackLink href={eventHref} className="mb-6">
            Back to event
          </BackLink>

          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[0_4px_20px_rgba(0,0,0,.05)]">
            <div className="relative bg-gradient-to-br from-sky-500 via-cyan-400 to-teal-300 p-6 text-white">
              <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_20%,rgba(255,255,255,.2)_20%,transparent_21%)] [background-size:28px_28px] opacity-50" />
              <div className="relative">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-white/15 px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm">
                  <span className="material-symbols-rounded text-[14px]">how_to_reg</span>
                  Registration
                </span>
                <h1 className="mt-3 text-lg font-bold">{data.event.title}</h1>
              </div>
            </div>
            <div className="space-y-6 p-6">
              <div className="space-y-2 text-sm text-muted-fg">
                <p className="flex items-center gap-2">
                  <span className="material-symbols-rounded text-base text-info">calendar_today</span>
                  {formatEventDate(data.event.event_date)}
                </p>
                <p className="flex items-center gap-2">
                  <span className="material-symbols-rounded text-base text-info">schedule</span>
                  {formatTime(data.event.start_time)} – {formatTime(data.event.end_time)}
                </p>
                <p className="flex items-center gap-2">
                  <span className="material-symbols-rounded text-base text-info">location_on</span>
                  {data.event.venue_name}
                </p>
              </div>

              <div className="border-t border-border pt-6">
                <h2 className="text-sm font-semibold text-fg">Your Information</h2>
                <div className="mt-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-rounded text-sm text-muted-fg">person</span>
                    <span className="text-sm text-fg">{data.user.full_name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-rounded text-sm text-muted-fg">mail</span>
                    <span className="text-sm text-fg">{data.user.email}</span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">{error}</div>
              )}

              <div className="border-t border-border pt-6">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 size-4 rounded border-border text-info focus:ring-info"
                  />
                  <span className="text-sm text-muted-fg">
                    I agree to the{" "}
                    <button className="font-medium text-info underline underline-offset-2 hover:text-info">
                      Terms of Service
                    </button>{" "}
                    and{" "}
                    <button className="font-medium text-info underline underline-offset-2 hover:text-info">
                      Privacy Policy
                    </button>
                  </span>
                </label>
              </div>

              <button
                disabled={!agreed || submitting}
                onClick={handleRegister}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-info/100 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-rounded text-sm">{submitting ? "progress_activity" : "how_to_reg"}</span>
                {submitting ? "Processing..." : "Proceed to Payment"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
