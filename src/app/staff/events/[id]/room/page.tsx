"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import QAPanel from "@/modules/chat/components/qa-panel";
import { EventSessionNavbar } from "@/modules/events/components/event-session-navbar";
import { useRoomAccess } from "@/modules/events/lib/use-room-access";
import type { UserRole } from "@/shared/types";

export default function StaffEventRoomPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const {
    access,
    eventTitle,
    eventDate,
    startTime,
    course,
    currentUserId,
    userRole,
    isStaff,
    eventStarted,
    eventEnded,
    elapsed,
    remaining,
    highlightedLessonId,
    settingHighlight,
    handleSetHighlight,
    handleClearHighlight,
  } = useRoomAccess(eventId);

  useEffect(() => {
    if (access === "denied" || access === "no_ticket") {
      router.replace(`/events/${eventId}/room`);
    }
  }, [access, eventId, router]);

  if (access === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Loading event room...</div>
      </div>
    );
  }

  if (access === "denied" || access === "no_ticket") {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Redirecting...</div>
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
        onExit={() => router.push(isStaff ? `/speakers/dashboard/${eventId}` : `/staff/events/${eventId}`)}
      />

      <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-6 min-h-0 xl:pr-[352px]">
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
              {course.MODULES && (
                <div className="mt-4 space-y-3">
                  {course.MODULES.map((mod) => (
                    <div key={mod.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-fg">{mod.module_name}</h3>
                      </div>
                      {mod.LESSONS && (
                        <div className="mt-2 space-y-1">
                          {mod.LESSONS.map((lesson) => (
                            <div key={lesson.id} className="flex items-center justify-between gap-2 text-xs text-muted-fg">
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-rounded text-[14px]">description</span>
                                {lesson.description}
                              </div>
                              {isStaff && (
                                <button
                                  onClick={() =>
                                    highlightedLessonId === lesson.id ? handleClearHighlight() : handleSetHighlight(lesson.id)
                                  }
                                  className={`rounded px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                                    highlightedLessonId === lesson.id
                                      ? "bg-brand text-white"
                                      : "bg-muted text-muted-fg hover:bg-brand/10 hover:text-brand"
                                  }`}
                                  disabled={settingHighlight}
                                >
                                  {highlightedLessonId === lesson.id ? "Highlighted" : "Highlight"}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="fixed right-4 top-24 z-10 flex h-[calc(100vh-120px)] w-72 flex-col sm:w-80 overflow-hidden rounded-xl">
        <QAPanel
          eventId={eventId}
          userRole={userRole as UserRole | null}
          currentUserId={currentUserId}
          eventStarted={eventStarted}
          eventEnded={eventEnded}
        />
      </div>
    </div>
  );
}
