"use client";

import { ROLES } from "@/shared/lib/roles";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/modules/auth/components/session-context";
import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import type { UserRole } from "@/shared/types";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { cn } from "@/shared/lib/utils";
import { parseLocalDateTime } from "@/shared/lib/date-utils";
import { LoadMoreButton } from "@/shared/components/load-more";
import { useEventDetail } from "@/modules/events/lib/use-event-detail";
import { useEventSpeakers } from "@/modules/events/lib/use-event-speakers";
import { useCourseByEvent } from "@/modules/courses/lib/use-course-by-event";
import { useCourseCreate } from "@/modules/courses/lib/use-course-create";
import { useSurveyStatus } from "@/modules/surveys/lib/use-survey-status";
import type { CourseSpeaker } from "@/modules/courses/lib/types";
import { CourseBuilderSection } from "@/modules/courses/components/course-builder-section";
import { CoverImageUpload } from "@/modules/events/components/cover-image-upload";
import { EditEventForm } from "@/modules/events/components/edit-event-form";

const TAB_KEYS = ["overview", "details", "course", "kiosk", "speakers", "surveys"] as const;
type TabKey = (typeof TAB_KEYS)[number];

const TABS: { key: TabKey; label: string; adminOnly?: boolean }[] = [
  { key: "overview", label: "Overview" },
  { key: "details", label: "Event Details", adminOnly: true },
  { key: "course", label: "Course" },
  { key: "kiosk", label: "Kiosk" },
  { key: "speakers", label: "Speakers", adminOnly: true },
  { key: "surveys", label: "Surveys", adminOnly: true },
];

function SectionCard({
  title,
  icon,
  children,
  className = "",
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-border bg-surface p-6 shadow-[0_4px_20px_0_rgba(0,0,0,0.05)] ${className}`}>
      <div className="mb-4 flex items-center gap-2.5 border-b border-border pb-3">
        <div className="rounded-lg bg-info/10 p-2">
          <span className="material-symbols-rounded text-[20px] text-brand">{icon}</span>
        </div>
        <span className="text-xs font-bold tracking-[0.1em] text-fg">{title.toUpperCase()}</span>
      </div>
      {children}
    </div>
  );
}

function OverviewSection({
  event,
  userRole,
  publishing,
  publishError,
  deleteError,
  handlePublish,
  handleDelete,
  attendeeCount,
}: {
  event: NonNullable<ReturnType<typeof useEventDetail>["event"]>;
  userRole: UserRole | null;
  publishing: boolean;
  publishError: string | null;
  deleteError: string | null;
  handlePublish: () => void;
  handleDelete: () => void;
  attendeeCount: number | undefined;
}) {
  const router = useRouter();
  const isAdmin = hasMinRole(userRole, ROLES.ADMIN);

  if (!hasMinRole(userRole, ROLES.FACILITATOR)) return null;

  return (
    <SectionCard title="Overview" icon="space_dashboard">
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-fg">Attendees</span>
          <span className="font-semibold text-fg">{attendeeCount ?? 0}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-fg">Status</span>
          <span className="font-semibold text-fg">{event.status}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-fg">Price</span>
          <span className="font-semibold text-fg">
            {event.currency} {event.price}
          </span>
        </div>
      </div>

      {publishError && <p className="mb-3 mt-3 text-xs text-error">{publishError}</p>}
      {deleteError && <p className="mb-3 mt-3 text-xs text-error">{deleteError}</p>}

      {/* Publish and Delete are admin-only: the server refuses them for facilitators. */}
      <div className="mt-5 flex flex-wrap gap-2">
        {isAdmin && event.status === "draft" && (
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand/80 disabled:opacity-50"
          >
            {publishing ? "Publishing..." : "Publish"}
          </button>
        )}
        {event.COURSE?.id && (
          <button
            onClick={() => router.push(`/courses/${event.COURSE?.id}/room`)}
            className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-fg hover:bg-muted"
          >
            Enter Course Room
          </button>
        )}
        {isAdmin && (
          <button
            onClick={handleDelete}
            className="rounded-lg border border-error/30 px-4 py-2 text-xs font-semibold text-error hover:bg-error/10"
          >
            Delete
          </button>
        )}
      </div>
    </SectionCard>
  );
}

export function CourseSection({
  eventId,
  userRole,
  canManageCourse,
  eventSpeakers,
  speakersLoading,
  eventStartTime,
  eventEndTime,
}: {
  eventId: string;
  userRole: UserRole | null;
  canManageCourse: boolean;
  eventSpeakers: CourseSpeaker[];
  speakersLoading: boolean;
  eventStartTime: string | null;
  eventEndTime: string | null;
}) {
  const { course, loading } = useCourseByEvent(eventId);
  const courseBuilder = useCourseCreate(eventId);
  const isStaff = hasMinRole(userRole, ROLES.FACILITATOR);

  if (loading || speakersLoading) {
    return (
      <SectionCard title="Course" icon="school">
        <p className="text-sm text-muted-fg">Loading course...</p>
      </SectionCard>
    );
  }

  if (course) {
    const totalLessons = course.MODULE.reduce((sum, m) => sum + m.LESSONS.length, 0);
    return (
      <SectionCard title="Course" icon="school">
        <p className="text-sm font-semibold text-fg">{course.course_name}</p>
        {course.course_description && <p className="mt-1 text-xs text-muted-fg">{course.course_description}</p>}
        <p className="mt-3 text-xs text-muted-fg">
          {course.MODULE.length} module{course.MODULE.length !== 1 ? "s" : ""} &middot; {totalLessons} lesson
          {totalLessons !== 1 ? "s" : ""}
        </p>
      </SectionCard>
    );
  }

  if (canManageCourse) {
    return (
      <SectionCard title="Course" icon="school">
        <CourseBuilderSection
          builder={courseBuilder}
          eventSpeakers={eventSpeakers}
          eventStartTime={eventStartTime}
          eventEndTime={eventEndTime}
        />
      </SectionCard>
    );
  }

  if (!isStaff && !canManageCourse) {
    return null;
  }

  return (
    <SectionCard title="Course" icon="school">
      <p className="text-sm text-muted-fg">Waiting for the speaker to create a course for this event.</p>
    </SectionCard>
  );
}

function SpeakersSection({ speakers, userRole }: { speakers: ReturnType<typeof useEventSpeakers>; userRole: UserRole | null }) {
  const {
    assignments,
    allProfiles,
    loading,
    selectedProfileId,
    setSelectedProfileId,
    availableProfiles,
    profilesLoadingMore,
    profilesHasMore,
    loadMoreProfiles,
    handleAssign,
    handleRemove,
  } = speakers;

  if (!hasMinRole(userRole, ROLES.ADMIN)) return null;

  return (
    <SectionCard title="Speakers" icon="record_voice_over">
      {loading ? (
        <p className="text-sm text-muted-fg">Loading speakers...</p>
      ) : (
        <>
          {assignments.length > 0 && (
            <ul className="mb-4 space-y-2">
              {assignments.map((a) => {
                const userInfo = allProfiles.find((p) => p.id === a.speaker_profile_id);
                return (
                  <li
                    key={a.speaker_profile_id}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2"
                  >
                    <span className="text-sm text-fg">{userInfo?.USER?.full_name ?? `Speaker #${a.speaker_profile_id}`}</span>
                    <button onClick={() => handleRemove(a.speaker_profile_id)} className="text-xs text-error hover:underline">
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {availableProfiles.length > 0 && (
            <form onSubmit={handleAssign} className="flex gap-2">
              <select
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg"
              >
                <option value="">Select a speaker...</option>
                {availableProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.USER?.full_name ?? `Speaker #${p.id}`}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={!selectedProfileId}
                className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand/80 disabled:opacity-50"
              >
                Assign
              </button>
            </form>
          )}

          {availableProfiles.length === 0 && assignments.length > 0 && (
            <p className="text-xs text-muted-fg">All speakers are assigned to this event.</p>
          )}

          {profilesHasMore && (
            <LoadMoreButton loading={profilesLoadingMore} onLoadMore={loadMoreProfiles} label="Load more speakers" />
          )}
        </>
      )}
    </SectionCard>
  );
}

function KioskSection({ eventId, userRole }: { eventId: string; userRole: UserRole | null }) {
  const router = useRouter();

  if (!hasMinRole(userRole, ROLES.FACILITATOR)) return null;

  return (
    <SectionCard title="Kiosk" icon="qr_code_scanner">
      <p className="mb-3 text-sm text-muted-fg">Scan attendee QR codes for check-in.</p>
      <button
        onClick={() => router.push(`/staff/events/${eventId}/kiosk`)}
        className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand/80"
      >
        Open Kiosk
      </button>
    </SectionCard>
  );
}

function SurveysSection({
  event,
  userRole,
}: {
  event: NonNullable<ReturnType<typeof useEventDetail>["event"]>;
  userRole: UserRole | null;
}) {
  const router = useRouter();
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

  if (!hasMinRole(userRole, ROLES.ADMIN)) return null;

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
      setSettingError(body.error?.message ?? "Failed to update survey setting");
      setSaving(false);
      return;
    }
    setEnabled(next);
    setSaving(false);
  }

  async function handleSend() {
    setSending(true);
    setSendMessage(null);
    setSettingError(null);
    const res = await fetch(`/api/events/${eventId}/survey/send`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json();
      setSettingError(body.error ?? "Failed to send survey");
      setSending(false);
      return;
    }
    const result = await res.json();
    if (result.failed > 0) {
      setSendMessage(`Delivered ${result.delivered} of ${result.recipients}; the rest will be retried on the next send.`);
    } else {
      setSendMessage(`Survey emailed to ${result.delivered} attendee${result.delivered === 1 ? "" : "s"}.`);
    }
    setSending(false);
    mutate();
  }

  const canSend = enabled && finished;
  const showSend = canSend && (!status?.survey || (status.survey.undelivered_count > 0 && !status.survey.expired));
  const respondedCount = status?.results.counts.reduce((sum, count) => sum + count, 0) ?? 0;

  return (
    <SectionCard title="Surveys" icon="poll">
      {enabled && loading ? (
        <p className="text-sm text-muted-fg">Loading survey...</p>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-fg">Post-event survey</p>
              <p className="text-xs text-muted-fg">Email a rating + comment form to registered attendees.</p>
            </div>
            <button
              onClick={() => handleToggle(!enabled)}
              disabled={saving}
              role="switch"
              aria-checked={enabled}
              aria-label="Enable post-event survey"
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${enabled ? "bg-brand" : "bg-muted"}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${enabled ? "translate-x-[22px]" : "translate-x-0.5"}`}
              />
            </button>
          </div>

          {settingError && <p className="mb-3 text-xs text-error">{settingError}</p>}
          {error && <p className="mb-3 text-xs text-error">{error}</p>}

          {enabled && (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                {showSend && (
                  <button
                    onClick={handleSend}
                    disabled={sending}
                    className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand/80 disabled:opacity-50"
                  >
                    {sending ? "Sending..." : status?.survey ? "Retry send" : "Send survey"}
                  </button>
                )}
                <button
                  onClick={() => router.push(`/staff/events/${eventId}/survey-preview`)}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-fg hover:bg-muted"
                >
                  Preview form
                </button>
              </div>

              {sendMessage && <p className="mb-3 text-xs text-success">{sendMessage}</p>}

              {status?.survey ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-muted p-3">
                      <p className="text-lg font-bold text-fg">{status.survey.total_recipients}</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-fg">Recipients</p>
                    </div>
                    <div className="rounded-lg bg-muted p-3">
                      <p className="text-lg font-bold text-fg">{respondedCount}</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-fg">Responded</p>
                    </div>
                    <div className="rounded-lg bg-muted p-3">
                      <p className="text-lg font-bold text-fg">{status.results.average ?? "\u2014"}</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-fg">Average</p>
                    </div>
                  </div>

                  {status.survey.undelivered_count > 0 && !status.survey.expired && (
                    <p className="text-xs text-muted-fg">
                      {status.survey.undelivered_count} email{status.survey.undelivered_count === 1 ? "" : "s"} not yet
                      delivered &mdash; use &ldquo;Retry send&rdquo;.
                    </p>
                  )}

                  {status.results.counts.some((count) => count > 0) && (
                    <div className="space-y-1.5">
                      {[5, 4, 3, 2, 1].map((star) => {
                        const count = status.results.counts[star - 1];
                        const max = Math.max(...status.results.counts);
                        const width = max > 0 ? (count / max) * 100 : 0;
                        return (
                          <div key={star} className="flex items-center gap-2 text-xs text-muted-fg">
                            <span className="w-3 text-fg">{star}</span>
                            <span className="material-symbols-rounded text-[14px] text-amber-400">star</span>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-brand" style={{ width: `${width}%` }} />
                            </div>
                            <span className="w-5 text-right">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {status.results.comments.length > 0 && (
                    <ul className="space-y-2">
                      {status.results.comments.map((comment, i) => (
                        <li key={i} className="rounded-lg border border-border bg-muted p-3">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-rounded text-[14px] text-amber-400">star</span>
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
        </>
      )}
    </SectionCard>
  );
}

export function StaffEventDetailPage({ initialTab }: { initialTab?: string }) {
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;
  const { user } = useSession();
  const { role: userRole, allowed: isStaff, pending } = useRoleGuard(ROLES.FACILITATOR);

  const {
    event,
    loading,
    error,
    badgeProps,
    publishing,
    publishError,
    deleteError,
    attendeesTotal,
    handlePublish,
    handleDelete,
  } = useEventDetail(eventId);

  // One speakers fetch for the page; the course builder's roster and the admin
  // section both read from it rather than hitting /api/events/[id]/speakers twice.
  const speakers = useEventSpeakers(eventId);
  const eventSpeakers: CourseSpeaker[] = speakers.assignments
    .map((row) => ({
      speaker_profile_id: row.speaker_profile_id,
      full_name: row.SPEAKER_PROFILE?.USER?.full_name ?? null,
    }))
    .filter((speaker): speaker is CourseSpeaker => speaker.full_name !== null);

  // Seeded once from the C-02 `?tab=details` edit link; a role that cannot use
  // the requested tab falls back to Overview without rewriting the state.
  const [activeTab, setActiveTab] = useState<TabKey>(
    TAB_KEYS.includes(initialTab as TabKey) ? (initialTab as TabKey) : "overview",
  );

  if (pending || loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-fg">Loading event...</div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-error">{error ?? "Event not found"}</div>
      </div>
    );
  }

  if (!isStaff) return null;

  const isAdmin = hasMinRole(userRole, ROLES.ADMIN);
  const tabs = TABS.filter((tab) => !tab.adminOnly || isAdmin);
  const currentTab = tabs.some((tab) => tab.key === activeTab) ? activeTab : "overview";
  // The list pages are split by role since C-02; go back to the one this role sees.
  const backHref = isAdmin ? "/staff/events" : "/staff/events/assigned";
  // The page is facilitator-floor, so the assignment term is the facilitator row.
  const isAssignedFacilitator = event.EVENT_FACILITATOR?.some((f) => f.user_id === user?.id) ?? false;
  const canManageCourse = isAdmin || isAssignedFacilitator;

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <div className="mx-auto w-full max-w-[1200px] px-5 py-12 sm:px-8">
        <button
          onClick={() => router.push(backHref)}
          className="mb-6 flex items-center gap-1.5 text-sm font-medium text-muted-fg transition-colors hover:text-fg"
        >
          <span className="material-symbols-rounded text-[16px]">arrow_back</span>
          Back to Events
        </button>

        <div className="mb-8">
          <span className="mb-2 inline-flex items-center rounded-full bg-info/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-brand">
            {badgeProps?.label ?? event.status}
          </span>
          <h1 className="text-[32px] font-bold tracking-[-0.02em] text-fg">{event.title}</h1>
          <p className="mt-2 text-sm text-muted-fg">
            {event.event_date} &middot; {event.start_time} - {event.end_time}
          </p>
          {event.venue_name && <p className="mt-1 text-sm text-muted-fg">{event.venue_name}</p>}
        </div>

        {event.description && <p className="mb-8 text-sm leading-relaxed text-fg">{event.description}</p>}

        <div className="mb-6 flex gap-1.5 border-b border-border pb-3">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs transition-colors",
                currentTab === tab.key
                  ? "bg-surface-hover font-medium text-foreground"
                  : "text-muted-foreground hover:bg-surface-hover",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {currentTab === "overview" && (
          <OverviewSection
            event={event}
            userRole={userRole}
            publishing={publishing}
            publishError={publishError}
            deleteError={deleteError}
            handlePublish={handlePublish}
            handleDelete={handleDelete}
            attendeeCount={attendeesTotal}
          />
        )}

        {currentTab === "details" && (
          <div className="space-y-6">
            <SectionCard title="Cover image" icon="image">
              <p className="mb-3 text-sm text-muted-fg">Shown on event cards across the site.</p>
              <CoverImageUpload eventId={eventId} initialUrl={event.cover_image_url} />
            </SectionCard>
            <EditEventForm eventId={eventId} initialData={event} backHref={`/staff/events/${eventId}`} />
          </div>
        )}

        {currentTab === "course" && (
          <CourseSection
            eventId={eventId}
            userRole={userRole}
            canManageCourse={canManageCourse}
            eventSpeakers={eventSpeakers}
            speakersLoading={speakers.loading}
            eventStartTime={event.start_time}
            eventEndTime={event.end_time}
          />
        )}

        {currentTab === "kiosk" && <KioskSection eventId={eventId} userRole={userRole} />}

        {currentTab === "speakers" && <SpeakersSection speakers={speakers} userRole={userRole} />}

        {currentTab === "surveys" && <SurveysSection event={event} userRole={userRole} />}
      </div>
    </div>
  );
}
