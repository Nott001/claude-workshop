"use client";

import { ROLES } from "@/shared/lib/roles";
import { useEffect, useState } from "react";
import { useSession } from "@/modules/auth/components/session-context";
import useSWR from "swr";
import { fetcher } from "@/shared/lib/fetcher";
import { useEventTimer } from "@/shared/lib/use-event-timer";
import { findLiveModule } from "@/shared/lib/live-module";
import { isEventStarted, parseEventDateTime } from "@/shared/lib/date-utils";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { canAccessCourseRoom } from "@/modules/courses/lib/room-access-policy";
import { fetchCourseRoomAccess, type CourseRoomCourse } from "@/modules/courses/lib/fetch-course-room-access";

export type AccessLevel = "allowed" | "no_ticket" | "no_course" | "not_started" | "loading" | "denied";

export function useCourseRoomAccess(courseId: string) {
  const { isLoaded, isSignedIn, user } = useSession();
  const userRole = user?.role ?? null;
  const [access, setAccess] = useState<AccessLevel>("loading");
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [course, setCourse] = useState<CourseRoomCourse | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [assignedSpeakerCount, setAssignedSpeakerCount] = useState(0);
  const [isSpeakerAssigned, setIsSpeakerAssigned] = useState(false);
  const [settingHighlight, setSettingHighlight] = useState(false);

  const isStaff = hasMinRole(userRole, ROLES.SPEAKER);
  const eventStarted = isEventStarted(eventDate, startTime);
  const eventEnd = eventDate && endTime ? parseEventDateTime(eventDate, endTime) : null;
  const eventEnded = !!eventEnd && eventEnd <= new Date();

  const liveModule = findLiveModule(course?.MODULE ?? [], eventDate);

  const { elapsed, remaining } = useEventTimer(eventDate, startTime, endTime);

  const { data: highlightData, mutate: mutateHighlight } = useSWR(
    courseId ? `/api/courses/${courseId}/live/highlight` : null,
    fetcher,
    { refreshInterval: 5000, revalidateOnFocus: false, revalidateOnReconnect: false },
  );
  const highlightedLessonId = highlightData?.highlighted_lesson_id ?? null;

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!isSignedIn || !user) {
        if (!cancelled) setAccess("denied");
        return;
      }

      const accessData = await fetchCourseRoomAccess(courseId, user);
      if (cancelled) return;

      const eventData = accessData.event;
      if (!eventData) {
        setAccess("denied");
        return;
      }

      setEventId(String(eventData.id));
      setEventTitle(eventData.title || "Course Room");
      setEventDate(eventData.event_date ?? "");
      setStartTime(eventData.start_time ?? "");
      setEndTime(eventData.end_time ?? "");
      setCurrentUserId(user.id);
      setAssignedSpeakerCount(eventData.EVENT_SPEAKER?.length ?? 0);
      setIsSpeakerAssigned(accessData.isSpeakerAssigned);

      const gate = canAccessCourseRoom(user.role, accessData);
      if (gate !== "allowed") {
        if (!cancelled) setAccess(gate);
        return;
      }

      // The audience stays out until the opening edge passes; staff and
      // assigned speakers set up and run the room, so only ticket holders are
      // locked. The server withholds the course for them too — this gate only
      // decides what the page shows.
      const opened = isEventStarted(eventData.event_date, eventData.start_time);
      if (!opened && !hasMinRole(user.role, ROLES.SPEAKER)) {
        if (!cancelled) setAccess("not_started");
        return;
      }

      if (!cancelled) {
        setCourse(accessData.course);
        setAccess(accessData.course ? "allowed" : "no_course");
      }
    }

    if (!isLoaded) return;
    init();

    return () => {
      cancelled = true;
    };
  }, [courseId, isLoaded, isSignedIn, user]);

  function handleSetHighlight(lessonId: number) {
    setSettingHighlight(true);
    mutateHighlight({ highlighted_lesson_id: lessonId }, false);
    fetch(`/api/courses/${courseId}/live/highlight`, {
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
    fetch(`/api/courses/${courseId}/live/highlight`, {
      method: "DELETE",
    })
      .then(() => mutateHighlight())
      .finally(() => setSettingHighlight(false));
  }

  return {
    access,
    eventId,
    eventTitle,
    eventDate,
    startTime,
    endTime,
    course,
    currentUserId,
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
  };
}
