"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
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

interface CourseWithLessons {
  course_id: number;
  course_name: string;
  MODULES: {
    module_id: number;
    module_name: string;
    LESSONS: Lesson[];
  }[];
}

export default function LiveRoomPage() {
  const params = useParams();
  const eventId = params.id as string;
  const { isLoaded, isSignedIn } = useUser();

  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [course, setCourse] = useState<CourseWithLessons | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

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

  if (loading) return <div>Loading live session...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div>
      <h1>Live Session</h1>

      {userRole === "facilitator" && (
        <div>
          <button onClick={handleInitOrReset}>Initialize / Reset Session</button>
        </div>
      )}

      {canControl && course && allLessons.length > 0 && (
        <div>
          <h2>Speaker Controls</h2>
          <div>
            <button onClick={handlePrevious} disabled={currentLessonIndex <= 0 || updating}>
              Previous
            </button>
            <select
              value={currentLesson?.lesson_id ?? ""}
              onChange={(e) => handleSelectLesson(e.target.value)}
              disabled={updating}
            >
              <option value="">-- Select Lesson --</option>
              {allLessons.map((lesson) => (
                <option key={lesson.lesson_id} value={lesson.lesson_id}>
                  {lesson.description}
                </option>
              ))}
            </select>
            <button onClick={handleNext} disabled={currentLessonIndex >= allLessons.length - 1 || updating}>
              Next
            </button>
          </div>
          {currentLesson && (
            <p>
              Lesson {currentLessonIndex + 1} of {allLessons.length}
            </p>
          )}
        </div>
      )}

      <hr />

      <div>
        <h2>Current Lesson</h2>
        {currentLesson ? (
          <div>
            <h3>{currentLesson.description}</h3>
            <LessonViewer lesson={currentLesson} />
          </div>
        ) : (
          <p>Waiting for speaker...</p>
        )}
      </div>

      <hr />

      <div>
        <h2>Q&amp;A</h2>
        <ChatPanel eventId={eventId} channel="live_qa" userRole={userRole} currentUserId={currentUserId} />
      </div>

      <div>
        <h2>Support Chat</h2>
        <ChatPanel eventId={eventId} channel="support" userRole={userRole} currentUserId={currentUserId} />
      </div>
    </div>
  );
}
