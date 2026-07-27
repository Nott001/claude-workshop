"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/modules/auth";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { useEventTimer } from "@/modules/event-management/lib/use-event-timer";

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
  LESSONS: Lesson[];
}

interface CourseData {
  id: number;
  course_name: string;
  course_description: string | null;
  MODULES: Module[];
}

export type AccessLevel = "allowed" | "no_ticket" | "no_course" | "loading" | "denied";

export function useRoomAccess(eventId: string) {
  const { loading: isLoaded, isSignedIn, user } = useSession();
  const userRole = user?.role ?? null;
  const [access, setAccess] = useState<AccessLevel>("loading");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [course, setCourse] = useState<CourseData | null>(null);
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

  async function fetchCourse(courseId: number) {
    const res = await fetch(`/api/courses/${courseId}`);
    if (res.ok) {
      const data: CourseData = await res.json();
      setCourse(data);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!isSignedIn || !user) {
        if (!cancelled) setAccess("denied");
        return;
      }

      const eventRes = await fetch(`/api/events/${eventId}`);
      if (!eventRes.ok) {
        if (!cancelled) setAccess("denied");
        return;
      }

      const eventData = await eventRes.json();
      if (cancelled) return;

      setEventTitle(eventData.title || "Event Room");
      setEventDate(eventData.event_date ?? "");
      setStartTime(eventData.start_time ?? "");
      setEndTime(eventData.end_time ?? "");
      setCurrentUserId(user.id);

      const role = user.role;

      if (role === "facilitator") {
        if (eventData.course_id) {
          await fetchCourse(eventData.course_id);
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
            await fetchCourse(eventData.course_id);
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
        await fetchCourse(eventData.course_id);
      }

      if (!cancelled) setAccess(eventData.course_id ? "allowed" : "no_course");
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
