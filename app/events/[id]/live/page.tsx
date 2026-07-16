"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { subscribeToLiveSession } from "@/lib/realtime";
import LessonViewer from "@/components/lesson-viewer";
import ChatPanel from "@/components/chat-panel";
import type { LiveSessionState, UserRole } from "@/types";

interface Lesson {
  lesson_id: number;
  module_id: number;
  description: string;
  content_type: string;
  content_url: string;
  total_units: number;
  sequence_order: number;
}

interface Module {
  module_id: number;
  module_name: string;
  LESSONS: Lesson[];
}

interface CourseWithLessons {
  course_id: number;
  course_name: string;
  MODULES: Module[];
}

export default function LiveRoomPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const { isLoaded, isSignedIn } = useUser();

  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [course, setCourse] = useState<CourseWithLessons | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [elapsed, setElapsed] = useState("00:00:00");

  const courseRef = useRef(course);
  useEffect(() => {
    courseRef.current = course;
  }, [course]);

  const allLessons = course ? course.MODULES.flatMap((m) => m.LESSONS).sort((a, b) => a.sequence_order - b.sequence_order) : [];
  const currentLessonIndex = currentLesson ? allLessons.findIndex((l) => l.lesson_id === currentLesson.lesson_id) : -1;

  const syncLessonFromState = useCallback((state: LiveSessionState) => {
    const c = courseRef.current;
    if (!c) return;
    if (state.current_lesson_id) {
      const found = c.MODULES.flatMap((m) => m.LESSONS).find((l) => l.lesson_id === state.current_lesson_id);
      if (found) setCurrentLesson(found);
    } else {
      setCurrentLesson(null);
    }
  }, []);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/live/${eventId}`);
      if (!res.ok) return;
      const data: LiveSessionState = await res.json();
      syncLessonFromState(data);
    } catch {
      // silent
    }
  }, [eventId, syncLessonFromState]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);

      const [stateRes, eventRes] = await Promise.all([fetch(`/api/live/${eventId}`), fetch(`/api/events/${eventId}`)]);

      if (!stateRes.ok || !eventRes.ok) {
        if (!cancelled) setError("Failed to load live session");
        setLoading(false);
        return;
      }

      const stateData: LiveSessionState = await stateRes.json();
      const eventData = await eventRes.json();
      if (cancelled) return;

      setEventTitle(eventData.title || "Live Session");

      if (eventData.course_id) {
        const courseRes = await fetch(`/api/courses/${eventData.course_id}`);
        if (courseRes.ok) {
          const courseData: CourseWithLessons = await courseRes.json();
          if (!cancelled) {
            setCourse(courseData);
            if (stateData.current_lesson_id) {
              const found = courseData.MODULES.flatMap((m) => m.LESSONS).find(
                (l) => l.lesson_id === stateData.current_lesson_id,
              );
              if (found) setCurrentLesson(found);
            }
          }
        }
      }

      if (isLoaded && isSignedIn) {
        const userRes = await fetch("/api/auth/me");
        if (userRes.ok) {
          const userData = await userRes.json();
          if (!cancelled) {
            setUserRole(userData.role);
            setCurrentUserId(userData.user_id);
          }
        }
      }

      if (!cancelled) setLoading(false);
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [eventId, isLoaded, isSignedIn]);

  useEffect(() => {
    if (!eventId) return;

    const channel = subscribeToLiveSession(Number(eventId), (newState) => {
      syncLessonFromState(newState);
    });

    const polling = setInterval(() => {
      fetchState();
    }, 10000);

    return () => {
      channel.unsubscribe();
      clearInterval(polling);
    };
  }, [eventId, fetchState, syncLessonFromState]);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      const diff = Date.now() - start;
      const h = String(Math.floor(diff / 3600000)).padStart(2, "0");
      const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
      setElapsed(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  async function handleSelectLesson(lessonId: string) {
    setUpdating(true);
    setError(null);
    const res = await fetch(`/api/live/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_lesson_id: lessonId ? Number(lessonId) : null }),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Failed to update lesson");
    }
    setUpdating(false);
  }

  async function handlePrevious() {
    if (currentLessonIndex > 0) {
      await handleSelectLesson(String(allLessons[currentLessonIndex - 1].lesson_id));
    }
  }

  async function handleNext() {
    if (currentLessonIndex < allLessons.length - 1) {
      await handleSelectLesson(String(allLessons[currentLessonIndex + 1].lesson_id));
    }
  }

  async function handleInitOrReset() {
    await fetch(`/api/live/${eventId}/state`, { method: "POST" });
    setCurrentLesson(null);
  }

  const canControl = userRole === "speaker" || userRole === "facilitator";

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Loading live session...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-destructive">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="material-symbols-rounded text-lg text-blue-500">bolt</span>
          {eventTitle}
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="hidden sm:block">
            <span className="text-muted-foreground">Elapsed </span>
            <span className="font-semibold text-foreground tabular-nums">{elapsed}</span>
          </div>
          <button
            onClick={() => router.push(`/events/${eventId}`)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-600"
          >
            <span className="material-symbols-rounded text-sm">logout</span>
            Exit
          </button>
        </div>
      </div>

      {canControl && (
        <div className="border-b border-border bg-surface px-4 py-2 sm:px-6">
          <div className="flex items-center gap-3">
            {userRole === "facilitator" && (
              <button
                onClick={handleInitOrReset}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-surface-hover"
              >
                <span className="material-symbols-rounded text-sm">refresh</span>
                Reset
              </button>
            )}
            <button
              onClick={handlePrevious}
              disabled={currentLessonIndex <= 0 || updating}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-surface-hover disabled:opacity-40"
            >
              <span className="material-symbols-rounded text-sm">chevron_left</span>
              Previous
            </button>
            <select
              value={currentLesson?.lesson_id ?? ""}
              onChange={(e) => handleSelectLesson(e.target.value)}
              disabled={updating}
              className="rounded-lg border border-border bg-white px-2 py-1 text-xs text-foreground outline-none focus:border-blue-500"
            >
              <option value="">-- Select Lesson --</option>
              {allLessons.map((lesson) => (
                <option key={lesson.lesson_id} value={lesson.lesson_id}>
                  {lesson.description}
                </option>
              ))}
            </select>
            <button
              onClick={handleNext}
              disabled={currentLessonIndex >= allLessons.length - 1 || updating}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-surface-hover disabled:opacity-40"
            >
              Next
              <span className="material-symbols-rounded text-sm">chevron_right</span>
            </button>
            {currentLesson && (
              <span className="text-xs text-muted-foreground">
                {currentLessonIndex + 1} of {allLessons.length}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:flex-row">
        <div className="flex-1 space-y-4">
          {currentLesson && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <h2 className="mb-2 text-sm font-semibold text-foreground">{currentLesson.description}</h2>
              <LessonViewer lesson={currentLesson} />
            </div>
          )}

          {course && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <h2 className="mb-3 text-sm font-semibold text-foreground">Course syllabus</h2>
              <div className="space-y-1">
                {allLessons.map((lesson) => {
                  const isCurrent = currentLesson?.lesson_id === lesson.lesson_id;
                  const isPast = currentLessonIndex > allLessons.indexOf(lesson);
                  return (
                    <div
                      key={lesson.lesson_id}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs transition-colors ${
                        isCurrent
                          ? "border border-blue-500 bg-blue-50 text-blue-700"
                          : isPast
                            ? "text-muted-foreground/60"
                            : "text-muted-foreground hover:bg-surface-hover"
                      }`}
                    >
                      <span className="material-symbols-rounded text-sm">
                        {isCurrent ? "play_circle" : isPast ? "check_circle" : "radio_button_unchecked"}
                      </span>
                      <span className={isCurrent ? "font-semibold" : ""}>{lesson.description}</span>
                      {isCurrent && (
                        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                          Live
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!course && (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-surface p-8">
              <div className="text-center">
                <span className="material-symbols-rounded text-3xl text-muted-foreground/50">school</span>
                <p className="mt-2 text-sm text-muted-foreground">No curriculum linked to this event.</p>
              </div>
            </div>
          )}
        </div>

        <div className="w-full lg:w-[380px] lg:shrink-0">
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Q&A live feed</h2>
            </div>
            <ChatPanel eventId={eventId} channel="live_qa" userRole={userRole} currentUserId={currentUserId} />
          </div>
        </div>
      </div>
    </div>
  );
}
