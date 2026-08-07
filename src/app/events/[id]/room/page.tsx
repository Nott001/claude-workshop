"use client";

import { useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import QAPanel from "@/modules/chat/components/qa-panel";
import { ModuleScheduleBadge } from "@/modules/courses/components/module-schedule-badge";
import { EventSessionNavbar } from "@/modules/events/components/event-session-navbar";
import { LiveNowTag } from "@/modules/events/components/live-now-tag";
import { SessionTimeline } from "@/modules/events/components/session-timeline";
import { useRoomAccess } from "@/modules/events/lib/use-room-access";
import type { UserRole } from "@/shared/types";

export default function EventRoomPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const {
    access,
    eventTitle,
    eventDate,
    startTime,
    course,
    userRole,
    isStaff,
    liveModule,
    assignedSpeakerCount,
    eventStarted,
    eventEnded,
    elapsed,
    remaining,
  } = useRoomAccess(eventId);

  const handleToggleLock = useCallback(async (moduleId: number, currentLocked: boolean) => {
    await fetch(`/api/qa/module/${moduleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_locked: !currentLocked }),
    });
  }, []);

  if (access === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Loading event room...</div>
      </div>
    );
  }

  if (access === "denied") {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center">
          <span className="material-symbols-rounded text-4xl text-muted-foreground/50">lock</span>
          <p className="mt-3 text-sm text-muted-foreground">You need to sign in to access this room.</p>
        </div>
      </div>
    );
  }

  if (access === "no_ticket") {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center">
          <span className="material-symbols-rounded text-4xl text-muted-foreground/50">confirmation_number</span>
          <p className="mt-3 text-sm text-muted-foreground">You need a ticket to access this room.</p>
          <button
            onClick={() => router.push(`/events/${eventId}/register`)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand/80"
          >
            Register
          </button>
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
        onExit={() => {
          if (userRole === "speaker") {
            router.push(`/speaker/event/${eventId}`);
          } else if (isStaff) {
            router.push(`/staff/events/${eventId}`);
          } else {
            router.push(`/events/${eventId}`);
          }
        }}
      />

      <div className="flex min-h-0 flex-1">
        <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-6 min-h-0">
          <div className="mx-auto w-full max-w-[896px]">
            {access === "no_course" && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <span className="material-symbols-rounded text-4xl text-muted-foreground/50">school</span>
                <p className="mt-3 text-sm text-muted-foreground">No curriculum has been linked to this event yet.</p>
              </div>
            )}

            {course && (
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
                                  speakerName={assignedSpeakerCount > 1 ? (mod.SPEAKER_PROFILE?.USER?.full_name ?? null) : null}
                                />
                                {isLive && <LiveNowTag />}
                              </div>
                            </div>
                          )}
                          <QAPanel
                            moduleId={mod.id}
                            userRole={userRole as UserRole | null}
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
                            <div className="mt-2 space-y-1">
                              {mod.LESSONS.map((lesson) => (
                                <div key={lesson.id} className="flex items-center gap-2 text-xs text-muted-fg">
                                  <span className="material-symbols-rounded text-[14px]">description</span>
                                  {lesson.description}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {course && (
          <aside className="hidden w-72 shrink-0 flex-col overflow-y-auto border-l border-border px-5 py-8 lg:flex">
            <SessionTimeline modules={course.MODULE} eventDate={eventDate} assignedSpeakerCount={assignedSpeakerCount} />
          </aside>
        )}
      </div>
    </div>
  );
}
