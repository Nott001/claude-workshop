"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/modules/auth";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import QAPanel from "@/components/qa-panel";
import { EventSessionNavbar } from "@/components/event-session-navbar";
import { useEventTimer } from "@/modules/event-management/lib/use-event-timer";
import { RoomCurriculum } from "@/modules/event-management/ui/room-curriculum";
import { LessonViewerModal } from "@/modules/event-management/ui/lesson-viewer-modal";
import type { UserRole } from "@/types";

interface Lesson {
  id: number;
  module_id: number;
  description: string;
  content_type: string;
  content_url: string | null;
  sequence_order: number;
}

interface Module {
  id: number;
  module_name: string;
  sequence_order: number;
  LESSONS: Lesson[];
}

interface CourseData {
  id: number;
  course_name: string;
  course_description: string | null;
  MODULES: Module[];
}

type AccessLevel = "allowed" | "no_ticket" | "no_course" | "loading" | "denied";

export default function EventRoomPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const { loading: isLoaded, isSignedIn } = useSession();

  const [access, setAccess] = useState<AccessLevel>("loading");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [course, setCourse] = useState<CourseData | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [settingHighlight, setSettingHighlight] = useState(false);
  const isStaff = userRole === "speaker" || userRole === "facilitator";
  const eventStarted = eventDate && startTime ? new Date(`${eventDate}T${startTime}`) <= new Date() : false;
  const eventEnded = eventDate && endTime ? new Date(`${eventDate}T${endTime}`) <= new Date() : false;

  const { elapsed, remaining } = useEventTimer(eventDate, startTime, endTime);

  const { data: highlightData, mutate: mutateHighlight } = useSWR(
    eventId ? `/api/events/${eventId}/live/highlight` : null,
    fetcher,
    { refreshInterval: 5000, revalidateOnFocus: false, revalidateOnReconnect: false },
  );
  const highlightedLessonId = highlightData?.highlighted_lesson_id ?? null;

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!isSignedIn) {
        if (!cancelled) setAccess("denied");
        return;
      }

      const [eventRes, userRes] = await Promise.all([fetch(`/api/events/${eventId}`), fetch("/api/auth/me")]);

      if (!eventRes.ok || !userRes.ok) {
        if (!cancelled) setAccess("denied");
        return;
      }

      const eventData = await eventRes.json();
      const userData = await userRes.json();

      if (cancelled) return;

      setEventTitle(eventData.title || "Event Room");
      setEventDate(eventData.event_date ?? "");
      setStartTime(eventData.start_time ?? "");
      setEndTime(eventData.end_time ?? "");
      setUserRole(userData.role ?? null);
      setCurrentUserId(userData.user_id ?? null);

      const role = userData.role as string;

      if (role === "facilitator") {
        if (eventData.course_id) {
          const courseRes = await fetch(`/api/courses/${eventData.course_id}`);
          if (courseRes.ok) {
            const courseData: CourseData = await courseRes.json();
            if (!cancelled) setCourse(courseData);
          }
        }
        if (!cancelled) setAccess("allowed");
        return;
      }

      if (role === "speaker") {
        const speakerRes = await fetch("/api/speakers/me");
        const speakerData = speakerRes.ok ? await speakerRes.json() : null;
        const assigned =
          speakerData?.speaker_profile_id &&
          eventData.EVENT_SPEAKERS?.some(
            (es: { SPEAKER_PROFILES: { speaker_profile_id: number } }) =>
              es.SPEAKER_PROFILES.speaker_profile_id === speakerData.speaker_profile_id,
          );
        if (assigned) {
          if (eventData.course_id) {
            const courseRes = await fetch(`/api/courses/${eventData.course_id}`);
            if (courseRes.ok) {
              const courseData: CourseData = await courseRes.json();
              if (!cancelled) setCourse(courseData);
            }
          }
          if (!cancelled) setAccess("allowed");
        } else {
          if (!cancelled) setAccess("denied");
        }
        return;
      }

      const ticketRes = await fetch("/api/tickets");
      const tickets = ticketRes.ok ? await ticketRes.json() : [];
      const hasTicket = tickets.some(
        (t: { event_id: number; status: string }) => t.event_id === Number(eventId) && t.status !== "cancelled",
      );

      if (!hasTicket) {
        if (!cancelled) setAccess("no_ticket");
        return;
      }

      if (eventData.course_id) {
        const courseRes = await fetch(`/api/courses/${eventData.course_id}`);
        if (courseRes.ok) {
          const courseData: CourseData = await courseRes.json();
          if (!cancelled) setCourse(courseData);
        }
      }

      if (!cancelled) setAccess(eventData.course_id ? "allowed" : "no_course");
    }

    if (!isLoaded) return;

    init();

    return () => {
      cancelled = true;
    };
  }, [eventId, isLoaded, isSignedIn]);

  function handleSetHighlight(lessonId: number) {
    setSettingHighlight(true);
    mutateHighlight({ highlighted_lesson_id: lessonId }, false);
    fetch(`/api/events/${eventId}/live/highlight`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lesson_id: lessonId }),
    })
      .then(() => mutateHighlight())
      .finally(() => setSettingHighlight(false));
  }

  function handleClearHighlight() {
    setSettingHighlight(true);
    mutateHighlight({ highlighted_lesson_id: null }, false);
    fetch(`/api/events/${eventId}/live/highlight`, {
      method: "DELETE",
    })
      .then(() => mutateHighlight())
      .finally(() => setSettingHighlight(false));
  }

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
