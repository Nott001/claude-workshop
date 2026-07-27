"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import QAPanel from "@/components/qa-panel";
import { EventSessionNavbar } from "@/components/event-session-navbar";
import { RoomCurriculum } from "@/modules/event-management/ui/room-curriculum";
import { LessonViewerModal } from "@/modules/event-management/ui/lesson-viewer-modal";
import { useRoomAccess } from "@/modules/event-management/lib/use-room-access";
import type { UserRole } from "@/types";
import type { Lesson } from "@/modules/event-management/lib/use-room-access";

export default function EventRoomPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  const {
    access,
    eventTitle,
    eventDate,
    startTime,
    endTime,
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
        onExit={() => router.push(isStaff ? `/speakers/dashboard/${eventId}` : `/events/${eventId}`)}
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
            <RoomCurriculum
              course={course}
              highlightedLessonId={highlightedLessonId}
              isStaff={isStaff}
              eventStarted={eventStarted}
              settingHighlight={settingHighlight}
              onSetHighlight={handleSetHighlight}
              onClearHighlight={handleClearHighlight}
              onSelectLesson={setSelectedLesson}
            />
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

      <LessonViewerModal lesson={selectedLesson} onClose={() => setSelectedLesson(null)} />
    </div>
  );
}
