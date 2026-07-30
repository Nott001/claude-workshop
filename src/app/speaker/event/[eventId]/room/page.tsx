"use client";

import { useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import QAPanel from "@/modules/chat/components/qa-panel";
import { EventSessionNavbar } from "@/modules/events/components/event-session-navbar";
import { useRoomAccess } from "@/modules/events/lib/use-room-access";
import type { UserRole } from "@/shared/types";

export default function SpeakerEventRoomPage() {
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
    eventStarted,
    eventEnded,
    elapsed,
    remaining,
    highlightedLessonId,
    settingHighlight,
    handleSetHighlight,
    handleClearHighlight,
  } = useRoomAccess(eventId);

  const handleToggleLock = useCallback(async (moduleId: number, currentLocked: boolean) => {
    await fetch(`/api/qa/module/${moduleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_locked: !currentLocked }),
    });
    window.location.reload();
  }, []);

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
        <div className="text-sm text-muted-foreground">
          {access === "denied" ? "Access denied." : "You need a ticket to access this room."}
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
        onExit={() => router.push(`/speaker/event/${eventId}`)}
      />

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
                  {course.MODULE.map((mod) =>
                    mod.module_type === "qa" ? (
                      <div key={mod.id} className="rounded-lg border border-border overflow-hidden">
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
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
