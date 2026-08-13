"use client";

import { ROLES } from "@/shared/lib/roles";
import { useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import QAPanel from "@/modules/chat/components/qa-panel";
import { CurrentTopicCard } from "@/modules/courses/components/current-topic-card";
import { ModuleScheduleBadge } from "@/modules/courses/components/module-schedule-badge";
import { RoomLessonRow } from "@/modules/courses/components/room-lesson-row";
import { EventSessionNavbar } from "@/modules/events/components/event-session-navbar";
import { LiveNowTag } from "@/modules/events/components/live-now-tag";
import { SessionHero } from "@/modules/events/components/session-hero";
import { resolveCurrentTopic } from "@/modules/courses/lib/current-topic";
import { formatEventDate, formatTime } from "@/shared/lib/date-utils";
import { eventProgress } from "@/shared/lib/event-progress";
import { useCourseRoomAccess } from "@/modules/courses/lib/use-course-room-access";
import type { UserRole } from "@/shared/types";

export default function CourseRoomPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;

  const {
    access,
    eventId,
    eventTitle,
    eventDate,
    startTime,
    endTime,
    course,
    userRole,
    isStaff,
    liveModule,
    assignedSpeakerCount,
    isSpeakerAssigned,
    eventStarted,
    eventEnded,
    elapsed,
    remaining,
    highlightedLessonId,
    settingHighlight,
    handleSetHighlight,
    handleClearHighlight,
  } = useCourseRoomAccess(courseId);

  const handleToggleLock = useCallback(
    async (moduleId: number, currentLocked: boolean) => {
      await fetch(`/api/qa/module/${moduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_locked: !currentLocked }),
      });
      if (isStaff) {
        window.location.reload();
      }
    },
    [isStaff],
  );

  const handleExit = useCallback(() => {
    if (!eventId) return;
    if (userRole === ROLES.SPEAKER) {
      router.push(`/speaker/events/${eventId}`);
    } else if (isStaff) {
      router.push(`/staff/events/${eventId}`);
    } else {
      router.push(`/events/${eventId}`);
    }
  }, [eventId, userRole, isStaff, router]);

  const progress = eventProgress(eventDate, startTime, endTime, new Date());
  const topic = course ? resolveCurrentTopic(course.MODULE, eventDate, highlightedLessonId, new Date()) : null;
  const displayTopic = topic && assignedSpeakerCount <= 1 ? { ...topic, speakerName: null } : topic;

  if (access === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-fg">Loading course room...</div>
      </div>
    );
  }

  if (access === "denied") {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center">
          <span className="material-symbols-rounded text-4xl text-muted-fg/50">lock</span>
          <p className="mt-3 text-sm text-muted-fg">You need to sign in to access this room.</p>
        </div>
      </div>
    );
  }

  if (access === "no_ticket") {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center">
          <span className="material-symbols-rounded text-4xl text-muted-fg/50">confirmation_number</span>
          <p className="mt-3 text-sm text-muted-fg">You need a ticket to access this room.</p>
          {eventId && (
            <button
              onClick={() => router.push(`/events/${eventId}/register`)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand/80"
            >
              Register
            </button>
          )}
        </div>
      </div>
    );
  }

  if (access === "not_started") {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center">
          <span className="material-symbols-rounded text-4xl text-muted-fg/50">lock</span>
          <p className="mt-3 text-sm font-semibold text-fg">This room hasn&apos;t started yet.</p>
          <p className="mt-1 text-sm text-muted-fg">
            It opens on {formatEventDate(eventDate)} at {formatTime(startTime)}.
          </p>
          {eventId && (
            <button
              onClick={() => router.push(`/events/${eventId}`)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand/80"
            >
              Back to event
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-bg">
      <EventSessionNavbar
        eventName={eventTitle}
        elapsed={elapsed}
        remaining={remaining}
        eventDate={eventDate}
        startTime={startTime}
        liveModuleName={liveModule?.module_name}
        liveSpeakerName={assignedSpeakerCount > 1 ? (liveModule?.SPEAKER_PROFILE?.USER?.full_name ?? null) : null}
        onExit={handleExit}
      />

      <div className="flex min-h-0 flex-1">
        <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-6 min-h-0">
          <div className="mx-auto w-full max-w-[896px]">
            {access === "no_course" && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <span className="material-symbols-rounded text-4xl text-muted-fg/50">school</span>
                <p className="mt-3 text-sm text-muted-fg">No curriculum has been linked to this event yet.</p>
              </div>
            )}

            {course && (
              <div className="space-y-4">
                <SessionHero
                  title={eventTitle}
                  startTime={startTime}
                  endTime={endTime}
                  speakerName={assignedSpeakerCount > 1 ? (liveModule?.SPEAKER_PROFILE?.USER?.full_name ?? null) : null}
                  isLive={eventStarted && !eventEnded}
                  hasEnded={eventEnded}
                  progress={progress}
                />

                <CurrentTopicCard
                  topic={displayTopic}
                  isStaff={isStaff}
                  settingHighlight={settingHighlight}
                  onClearHighlight={handleClearHighlight}
                  showDescription
                />

                <div className="rounded-xl border border-border bg-surface p-6">
                  <h2 className="text-lg font-bold text-fg">{course.course_name}</h2>
                  {course.MODULE && (
                    <div className="mt-4 space-y-3">
                      {course.MODULE.map((mod) => {
                        const isLive = liveModule?.id === mod.id;
                        return mod.module_type === "qa" ? (
                          <div
                            key={mod.id}
                            className={`overflow-hidden rounded-lg border ${isLive ? "border-brand ring-1 ring-brand" : "border-border"}`}
                          >
                            {mod.start_time && mod.end_time && (
                              <div className="border-b border-border bg-muted px-4 py-2">
                                <div className="flex items-center justify-between gap-2">
                                  <ModuleScheduleBadge
                                    startTime={mod.start_time}
                                    endTime={mod.end_time}
                                    speakerName={
                                      assignedSpeakerCount > 1 ? (mod.SPEAKER_PROFILE?.USER?.full_name ?? null) : null
                                    }
                                  />
                                  {isLive && <LiveNowTag />}
                                </div>
                              </div>
                            )}
                            <QAPanel
                              moduleId={mod.id}
                              userRole={userRole as UserRole | null}
                              isSpeakerAssigned={isSpeakerAssigned}
                              eventStarted={eventStarted}
                              eventEnded={eventEnded}
                              isLocked={mod.is_locked}
                              onToggleLock={() => handleToggleLock(mod.id, mod.is_locked)}
                            />
                          </div>
                        ) : (
                          <div
                            key={mod.id}
                            className={`rounded-lg border p-3 ${isLive ? "border-brand ring-1 ring-brand" : "border-border"}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="text-sm font-semibold text-fg">{mod.module_name}</h3>
                              <div className="flex items-center gap-2">
                                {isLive && <LiveNowTag />}
                                <ModuleScheduleBadge
                                  startTime={mod.start_time}
                                  endTime={mod.end_time}
                                  speakerName={assignedSpeakerCount > 1 ? (mod.SPEAKER_PROFILE?.USER?.full_name ?? null) : null}
                                />
                              </div>
                            </div>
                            {mod.LESSONS && (
                              <div className="mt-2 space-y-2">
                                {mod.LESSONS.map((lesson) => (
                                  <RoomLessonRow
                                    key={lesson.id}
                                    lesson={lesson}
                                    isHighlighted={highlightedLessonId === lesson.id}
                                    isStaff={isStaff}
                                    settingHighlight={settingHighlight}
                                    onToggleHighlight={() =>
                                      highlightedLessonId === lesson.id ? handleClearHighlight() : handleSetHighlight(lesson.id)
                                    }
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
