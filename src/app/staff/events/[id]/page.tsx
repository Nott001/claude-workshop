"use client";

import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/modules/auth";
import type { UserRole } from "@/shared/types";
import { Footer } from "@/shared/components/footer";
import { hasMinRole } from "@/shared/auth/role-hierarchy";
import { useEventDetail } from "@/modules/events/lib/use-event-detail";
import { useEventSpeakers } from "@/modules/events/lib/use-event-speakers";
import { useCourseByEvent } from "@/modules/courses/lib/use-course-by-event";
import { useCourseCreate } from "@/modules/courses/lib/use-course-create";
import { CurriculumBuilder } from "@/modules/courses/ui/curriculum-builder";
import { LessonDialog } from "@/modules/courses/ui/lesson-dialog";
import dynamic from "next/dynamic";

const ChatPanel = dynamic(() => import("@/modules/chat/components/chat-panel"), { ssr: false });

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
  isFacilitator,
  publishing,
  publishError,
  deleteError,
  handlePublish,
  handleDelete,
  attendeeCount,
}: {
  event: NonNullable<ReturnType<typeof useEventDetail>["event"]>;
  isFacilitator: boolean;
  publishing: boolean;
  publishError: string | null;
  deleteError: string | null;
  handlePublish: () => void;
  handleDelete: () => void;
  attendeeCount: number | undefined;
}) {
  const router = useRouter();
  const eventId = String(event.id);

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

      {isFacilitator && (
        <div className="mt-5 flex flex-wrap gap-2">
          {event.status === "draft" && (
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand/80 disabled:opacity-50"
            >
              {publishing ? "Publishing..." : "Publish"}
            </button>
          )}
          <button
            onClick={() => router.push(`/staff/events/${eventId}/edit`)}
            className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-fg hover:bg-muted"
          >
            Edit
          </button>
          <button
            onClick={() => router.push(`/staff/events/${eventId}/room`)}
            className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-fg hover:bg-muted"
          >
            Enter Room
          </button>
          <button
            onClick={handleDelete}
            className="rounded-lg border border-error/30 px-4 py-2 text-xs font-semibold text-error hover:bg-error/10"
          >
            Delete
          </button>
        </div>
      )}
    </SectionCard>
  );
}

function CourseSection({ eventId, userRole }: { eventId: string; userRole: UserRole | null }) {
  const { course, loading } = useCourseByEvent(eventId);
  const courseBuilder = useCourseCreate();
  const router = useRouter();
  const isSpeaker = hasMinRole(userRole, "speaker");
  const isFacilitator = hasMinRole(userRole, "facilitator");
  const isAdmin = hasMinRole(userRole, "admin");
  const { assignments, loading: speakersLoading } = useEventSpeakers(eventId);

  const hasSpeakers = assignments.length > 0;

  if (loading) {
    return (
      <SectionCard title="Course" icon="school">
        <p className="text-sm text-muted-fg">Loading course...</p>
      </SectionCard>
    );
  }

  if (course) {
    const totalLessons = course.MODULE.reduce((sum, m) => sum + m.LESSON.length, 0);
    return (
      <SectionCard title="Course" icon="school">
        <p className="text-sm font-semibold text-fg">{course.course_name}</p>
        {course.course_description && <p className="mt-1 text-xs text-muted-fg">{course.course_description}</p>}
        <p className="mt-3 text-xs text-muted-fg">
          {course.MODULE.length} module{course.MODULE.length !== 1 ? "s" : ""} &middot; {totalLessons} lesson
          {totalLessons !== 1 ? "s" : ""}
        </p>
        <button
          onClick={() => router.push(`/courses/${course.id}`)}
          className="mt-4 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand/80"
        >
          View Course
        </button>
      </SectionCard>
    );
  }

  if (isSpeaker && courseBuilder.modules.length === 0) {
    return (
      <SectionCard title="Course" icon="school">
        <p className="text-sm text-muted-fg">No course yet for this event.</p>
        <button
          onClick={() => courseBuilder.handleAddModule()}
          className="mt-4 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand/80"
        >
          Create Course
        </button>
      </SectionCard>
    );
  }

  if (isSpeaker && courseBuilder.modules.length > 0) {
    return (
      <SectionCard title="Course" icon="school">
        <CurriculumBuilder
          modules={courseBuilder.modules}
          onAddModule={courseBuilder.handleAddModule}
          onRenameModule={courseBuilder.handleRenameModule}
          onDeleteModule={courseBuilder.handleDeleteModule}
          onDeleteLesson={courseBuilder.handleDeleteLesson}
          onAddLessonClick={courseBuilder.openLessonDialog}
          onReorderModules={courseBuilder.handleReorderModules}
          onReorderLessons={courseBuilder.handleReorderLessons}
        />
        <LessonDialog
          open={courseBuilder.lessonDialogModuleId !== null}
          onOpenChange={(open) => {
            if (!open) courseBuilder.setLessonDialogModuleId(null);
          }}
          onAddLesson={courseBuilder.handleAddLesson}
        />
      </SectionCard>
    );
  }

  if (!isAdmin && !isFacilitator && !isSpeaker) {
    return null;
  }

  if (isAdmin && !hasSpeakers && !speakersLoading) {
    return (
      <SectionCard title="Course" icon="school">
        <p className="text-sm text-muted-fg">Assign a speaker first to manage this event&apos;s course.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Course" icon="school">
      <p className="text-sm text-muted-fg">Waiting for the speaker to create a course for this event.</p>
    </SectionCard>
  );
}

function SpeakersSection({ eventId, userRole }: { eventId: string; userRole: UserRole | null }) {
  const {
    assignments,
    allProfiles,
    loading,
    selectedProfileId,
    setSelectedProfileId,
    availableProfiles,
    handleAssign,
    handleRemove,
  } = useEventSpeakers(eventId);

  if (!hasMinRole(userRole, "admin")) return null;

  return (
    <SectionCard title="Speakers" icon="record_voice_over">
      {loading ? (
        <p className="text-sm text-muted-fg">Loading speakers...</p>
      ) : (
        <>
          {assignments.length > 0 && (
            <ul className="mb-4 space-y-2">
              {assignments.map((a) => {
                const userInfo = allProfiles.find((p) => p.speaker_profile_id === a.speaker_profile_id);
                return (
                  <li
                    key={a.speaker_profile_id}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2"
                  >
                    <span className="text-sm text-fg">{userInfo?.USERS?.full_name ?? `Speaker #${a.speaker_profile_id}`}</span>
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
                  <option key={p.speaker_profile_id} value={p.speaker_profile_id}>
                    {p.USERS?.full_name ?? `Speaker #${p.speaker_profile_id}`}
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
        </>
      )}
    </SectionCard>
  );
}

function SupportSection({ eventId, userRole, userId }: { eventId: string; userRole: UserRole | null; userId: number | null }) {
  if (!hasMinRole(userRole, "facilitator")) return null;

  return (
    <SectionCard title="Support" icon="support_agent" className="row-span-2">
      <ChatPanel eventId={eventId} channel="support" userRole={userRole} currentUserId={userId} />
    </SectionCard>
  );
}

function KioskSection({ eventId, userRole }: { eventId: string; userRole: UserRole | null }) {
  const router = useRouter();

  if (!hasMinRole(userRole, "facilitator")) return null;

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

function SurveysSection({ userRole }: { userRole: UserRole | null }) {
  if (!hasMinRole(userRole, "facilitator")) return null;

  return (
    <SectionCard title="Surveys" icon="poll">
      <p className="text-sm text-muted-fg">Create and manage surveys for attendees.</p>
      <p className="mt-2 text-xs italic text-muted-fg">Coming soon.</p>
    </SectionCard>
  );
}

export default function StaffEventDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;
  const { user } = useSession();
  const userRole = user?.role ?? null;

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

  const isFacilitator = hasMinRole(userRole, "facilitator");
  const isStaff = hasMinRole(userRole, "facilitator");

  if (loading) {
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

  if (!isStaff) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-error">Access denied.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <div className="mx-auto w-full max-w-[1200px] px-5 py-12 sm:px-8">
        <button
          onClick={() => router.push("/staff/events")}
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

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <OverviewSection
            event={event}
            isFacilitator={isFacilitator}
            publishing={publishing}
            publishError={publishError}
            deleteError={deleteError}
            handlePublish={handlePublish}
            handleDelete={handleDelete}
            attendeeCount={attendeesTotal}
          />

          <CourseSection eventId={eventId} userRole={userRole} />

          <SpeakersSection eventId={eventId} userRole={userRole} />

          <SupportSection eventId={eventId} userRole={userRole} userId={user?.id ?? null} />

          <KioskSection eventId={eventId} userRole={userRole} />

          <SurveysSection userRole={userRole} />
        </div>
      </div>
      <Footer role={user?.role ?? null} />
    </div>
  );
}
