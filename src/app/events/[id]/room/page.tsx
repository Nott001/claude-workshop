"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import LessonViewer from "@/components/lesson-viewer";
import QAPanel from "@/components/qa-panel";
import { EventSessionNavbar } from "@/components/event-session-navbar";
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
  const { isLoaded, isSignedIn } = useUser();

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

  const [elapsed, setElapsed] = useState("00:00:00");
  const [remaining, setRemaining] = useState("--:--:--");

  const { data: highlightData, mutate: mutateHighlight } = useSWR(
    eventId ? `/api/events/${eventId}/live/highlight` : null,
    fetcher,
    { refreshInterval: 5000, revalidateOnFocus: false, revalidateOnReconnect: false },
  );
  const highlightedLessonId = highlightData?.highlighted_lesson_id ?? null;

  useEffect(() => {
    if (!eventDate || !startTime) return;
    function tick() {
      const start = new Date(`${eventDate}T${startTime}`);
      const end = endTime ? new Date(`${eventDate}T${endTime}`) : null;
      const now = new Date();

      const elapsedMs = now.getTime() - start.getTime();
      if (elapsedMs > 0) {
        const h = Math.floor(elapsedMs / 3600000);
        const m = Math.floor((elapsedMs % 3600000) / 60000);
        const s = Math.floor((elapsedMs % 60000) / 1000);
        setElapsed(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
      }

      if (end) {
        const remMs = end.getTime() - now.getTime();
        if (remMs > 0) {
          const h = Math.floor(remMs / 3600000);
          const m = Math.floor((remMs % 3600000) / 60000);
          const s = Math.floor((remMs % 60000) / 1000);
          setRemaining(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
        } else {
          setRemaining("00:00:00");
        }
      }
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [eventDate, startTime, endTime]);

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

  function contentTypeIcon(contentType: string, contentUrl: string | null): string {
    if ((contentType === "video" && contentUrl?.includes("youtube.com")) || contentUrl?.includes("youtu.be")) {
      return "play_circle";
    }
    const icons: Record<string, string> = {
      pdf: "picture_as_pdf",
      video: "smart_display",
      image: "image",
      link: "link",
    };
    return icons[contentType] || "description";
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
            <div className="space-y-8">
              <div>
                <h1 className="text-xl font-bold text-fg">{course.course_name}</h1>
                {course.course_description && <p className="mt-1 text-sm text-muted-foreground">{course.course_description}</p>}
              </div>

              {course.MODULES.map((mod, modIdx) => (
                <div key={mod.id}>
                  <h2 className="mb-3 text-sm font-semibold text-fg">
                    {modIdx + 1}. {mod.module_name}
                  </h2>
                  <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-[0_4px_20px_0_rgba(0,0,0,0.05)]">
                    {mod.LESSONS.map((lesson, lessonIdx) => {
                      const isHighlighted = highlightedLessonId === lesson.id;
                      return (
                        <div
                          key={lesson.id}
                          className={"relative transition-colors " + (isHighlighted ? "bg-[rgba(0,150,199,0.06)]" : "")}
                        >
                          {isHighlighted && <div className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-brand" />}
                          <button
                            onClick={() => setSelectedLesson(lesson)}
                            className={
                              "flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted " +
                              (isHighlighted ? "pr-20" : "")
                            }
                          >
                            <span
                              className={
                                "flex size-10 shrink-0 items-center justify-center rounded-xl " +
                                (isHighlighted ? "bg-[rgba(0,150,199,0.15)]" : "bg-[rgba(0,101,141,0.1)]")
                              }
                            >
                              <span
                                className={"material-symbols-rounded text-lg " + (isHighlighted ? "text-brand" : "text-brand")}
                              >
                                {isHighlighted
                                  ? "radio_button_checked"
                                  : contentTypeIcon(lesson.content_type, lesson.content_url)}
                              </span>
                            </span>
                            <div className="flex min-w-0 flex-1 flex-col">
                              <span className="text-sm font-medium text-fg">
                                <span className="text-muted-foreground">
                                  {modIdx + 1}.{lessonIdx + 1}
                                </span>
                                &ensp;{lesson.description}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  {lesson.content_type}
                                </span>
                                {isHighlighted && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(0,150,199,0.1)] px-2 py-0.5 text-[10px] font-semibold text-brand">
                                    <span className="material-symbols-rounded text-[10px]">visibility</span>
                                    Guiding
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                          {isStaff && eventStarted && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                              {isHighlighted ? (
                                <button
                                  onClick={handleClearHighlight}
                                  disabled={settingHighlight}
                                  className="flex items-center gap-1 rounded-lg border border-[rgba(0,150,199,0.3)] bg-surface px-2.5 py-1.5 text-[10px] font-bold text-brand transition-colors hover:bg-[rgba(0,150,199,0.06)] disabled:opacity-50"
                                >
                                  <span className="material-symbols-rounded text-xs">close</span>
                                  Clear
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleSetHighlight(lesson.id)}
                                  disabled={settingHighlight}
                                  className="flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[10px] font-bold text-muted-fg transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
                                >
                                  <span className="material-symbols-rounded text-xs">arrow_right_alt</span>
                                  Guide
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
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

      {selectedLesson && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-2"
          onClick={() => setSelectedLesson(null)}
        >
          <div
            className="flex h-full w-full max-h-[98vh] max-w-[98vw] flex-col rounded-xl border border-border bg-surface shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-base font-semibold text-foreground">{selectedLesson.description}</h2>
              <div className="flex items-center gap-2">
                <a
                  href={selectedLesson.content_url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                  title="Open in new tab"
                >
                  <span className="material-symbols-rounded text-lg">open_in_new</span>
                </a>
                <button
                  onClick={() => setSelectedLesson(null)}
                  className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                >
                  <span className="material-symbols-rounded text-lg">close</span>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {(() => {
                const content_url = selectedLesson.content_url;
                if (!content_url) {
                  return (
                    <div className="flex items-center justify-center py-16 text-center">
                      <span className="material-symbols-rounded text-3xl text-muted-foreground/50">link_off</span>
                      <p className="mt-2 text-sm text-muted-foreground">No content available for this resource.</p>
                    </div>
                  );
                }
                return <LessonViewer lesson={{ ...selectedLesson, content_url }} />;
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
