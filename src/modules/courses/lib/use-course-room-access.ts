"use client";

import { ROLES } from "@/shared/lib/roles";
import { useEffect, useState } from "react";
import { useSession } from "@/modules/auth/components/session-context";
import { findLiveModule } from "@/shared/lib/live-module";
import { isEventStarted, parseEventDateTime } from "@/shared/lib/date-utils";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { canAccessCourseRoom } from "@/modules/courses/lib/room-access-policy";
import { fetchCourseRoomAccess, type CourseRoomCourse } from "@/modules/courses/lib/fetch-course-room-access";
import { subscribeToCourseHighlight, unsubscribe } from "@/shared/integrations/realtime";

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

  // Edge-state flips (start / end / live module) only need coarse granularity;
  // SessionHero already refreshes on this cadence. The navbar's per-second
  // countdown lives in the navbar itself, not here.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const isStaff = hasMinRole(userRole, ROLES.SPEAKER);
  const eventStarted = isEventStarted(eventDate, startTime);
  const eventEnd = eventDate && endTime ? parseEventDateTime(eventDate, endTime) : null;
  const eventEnded = !!eventEnd && eventEnd <= now;

  const liveModule = findLiveModule(course?.MODULE ?? [], eventDate, now);

  const [highlightedLessonId, setHighlightedLessonId] = useState<number | null>(null);

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

      // Seed the highlight once; the realtime channel below carries every
      // change after it. A failed seed is fine — the next broadcast corrects.
      try {
        const res = await fetch(`/api/courses/${courseId}/live/highlight`);
        if (!cancelled && res.ok) {
          const body = (await res.json()) as { highlighted_lesson_id?: number | null };
          setHighlightedLessonId(body.highlighted_lesson_id ?? null);
        }
      } catch {
        // ignore, the channel is the source of truth
      }
    }

    if (!isLoaded) return;
    init();

    return () => {
      cancelled = true;
    };
  }, [courseId, isLoaded, isSignedIn, user]);

  useEffect(() => {
    if (access !== "allowed") return;

    const channel = subscribeToCourseHighlight(Number(courseId), setHighlightedLessonId);
    return () => unsubscribe(channel);
  }, [courseId, access]);

  async function persistHighlight(init: RequestInit) {
    try {
      const res = await fetch(`/api/courses/${courseId}/live/highlight`, init);
      if (res.ok) return;
    } catch {
      // fall through to reconciliation below
    }
    const reconciled = await fetch(`/api/courses/${courseId}/live/highlight`);
    if (reconciled.ok) {
      const body = (await reconciled.json()) as { highlighted_lesson_id?: number | null };
      setHighlightedLessonId(body.highlighted_lesson_id ?? null);
    } else {
      setHighlightedLessonId(null);
    }
  }

  function handleSetHighlight(lessonId: number) {
    setSettingHighlight(true);
    setHighlightedLessonId(lessonId);
    void persistHighlight({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lesson_id: lessonId }),
    }).finally(() => setSettingHighlight(false));
  }

  function handleClearHighlight() {
    setSettingHighlight(true);
    setHighlightedLessonId(null);
    void persistHighlight({
      method: "DELETE",
    }).finally(() => setSettingHighlight(false));
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
    highlightedLessonId,
    settingHighlight,
    handleSetHighlight,
    handleClearHighlight,
  };
}
