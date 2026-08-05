"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/modules/auth/components/session-context";
import useSWR from "swr";
import { fetcher } from "@/shared/lib/fetcher";
import { useEventTimer } from "@/modules/events/lib/use-event-timer";
import { fetchEventAccess } from "@/modules/events/lib/fetch-event-access";
import { canAccessRoom } from "@/modules/events/lib/room-access-policy";
import { hasMinRole } from "@/shared/lib/role-hierarchy";

export interface Lesson {
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
  module_type: string;
  is_locked: boolean;
  LESSONS: Lesson[];
}

interface CourseData {
  id: number;
  course_name: string;
  course_description: string | null;
  MODULE: Module[];
}

export type AccessLevel = "allowed" | "no_ticket" | "no_course" | "loading" | "denied";

export function useRoomAccess(eventId: string) {
  const { isLoaded, isSignedIn, user } = useSession();
  const userRole = user?.role ?? null;
  const [access, setAccess] = useState<AccessLevel>("loading");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [course, setCourse] = useState<CourseData | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [settingHighlight, setSettingHighlight] = useState(false);

  const isStaff = hasMinRole(userRole, "speaker");
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
      if (!isSignedIn || !user) {
        if (!cancelled) setAccess("denied");
        return;
      }

      const accessData = await fetchEventAccess(eventId, user);
      if (cancelled) return;

      const eventData = accessData.event;
      if (!eventData) {
        setAccess("denied");
        return;
      }

      setEventTitle(eventData.title || "Event Room");
      setEventDate(eventData.event_date ?? "");
      setStartTime(eventData.start_time ?? "");
      setEndTime(eventData.end_time ?? "");
      setCurrentUserId(user.id);

      const gate = canAccessRoom(user.role, accessData);
      if (gate !== "allowed") {
        if (!cancelled) setAccess(gate);
        return;
      }

      if (eventData.COURSE?.id) {
        const res = await fetch(`/api/courses/event/${eventId}`);
        if (res.ok) {
          const data: CourseData = await res.json();
          if (!cancelled) setCourse(data);
        }
      }

      if (!cancelled) setAccess(eventData.COURSE?.id ? "allowed" : "no_course");
    }

    if (!isLoaded) return;
    init();

    return () => {
      cancelled = true;
    };
  }, [eventId, isLoaded, isSignedIn, user]);

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

  return {
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
  };
}
