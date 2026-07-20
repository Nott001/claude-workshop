"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import LessonViewer from "@/components/lesson-viewer";

interface Lesson {
  lesson_id: number;
  module_id: number;
  description: string;
  content_type: string;
  content_url: string | null;
  sequence_order: number;
}

interface Module {
  module_id: number;
  module_name: string;
  sequence_order: number;
  LESSONS: Lesson[];
}

interface CourseData {
  course_id: number;
  course_name: string;
  course_description: string | null;
  MODULES: Module[];
}

type AccessLevel = "allowed" | "not_started" | "no_ticket" | "no_course" | "loading" | "denied";

export default function EventRoomPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const { isLoaded, isSignedIn } = useUser();

  const [access, setAccess] = useState<AccessLevel>("loading");
  const [eventTitle, setEventTitle] = useState("");
  const [course, setCourse] = useState<CourseData | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

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

      const role = userData.role as string;

      if (role === "facilitator" || role === "speaker") {
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

      const ticketRes = await fetch("/api/tickets");
      const tickets = ticketRes.ok ? await ticketRes.json() : [];
      const hasTicket = tickets.some(
        (t: { event_id: number; status: string }) => t.event_id === Number(eventId) && t.status !== "cancelled",
      );

      if (!hasTicket) {
        if (!cancelled) setAccess("no_ticket");
        return;
      }

      const eventStarted = new Date(`${eventData.event_date}T${eventData.start_time}`) <= new Date();
      if (!eventStarted) {
        if (!cancelled) setAccess("not_started");
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

  const contentTypes: Record<string, string> = {
    pdf: "description",
    video: "play_circle",
    image: "image",
    link: "link",
  };

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
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#29B6F6] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#039be5]"
          >
            Register
          </button>
        </div>
      </div>
    );
  }

  if (access === "not_started") {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center">
          <span className="material-symbols-rounded text-4xl text-muted-foreground/50">schedule</span>
          <p className="mt-3 text-sm text-muted-foreground">The event has not started yet.</p>
          <p className="text-xs text-muted-foreground/60">Please wait until the event begins.</p>
          <button
            onClick={() => router.push(`/events/${eventId}`)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-surface-hover"
          >
            Back to event
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-[#FBF9F8]">
      <div className="flex items-center justify-between border-b border-border bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="material-symbols-rounded text-lg text-blue-500">bolt</span>
          {eventTitle}
        </div>
        <button
          onClick={() => router.push(`/events/${eventId}`)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-600"
        >
          <span className="material-symbols-rounded text-sm">logout</span>
          Exit
        </button>
      </div>

      <div className="mx-auto w-full max-w-[896px] px-4 py-8 sm:px-6">
        {access === "no_course" && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="material-symbols-rounded text-4xl text-muted-foreground/50">school</span>
            <p className="mt-3 text-sm text-muted-foreground">No curriculum has been linked to this event yet.</p>
          </div>
        )}

        {course && (
          <div className="space-y-8">
            <div>
              <h1 className="text-xl font-bold text-[#1B1C1C]">{course.course_name}</h1>
              {course.course_description && <p className="mt-1 text-sm text-muted-foreground">{course.course_description}</p>}
            </div>

            {course.MODULES.map((mod) => (
              <div key={mod.module_id}>
                <h2 className="mb-3 text-sm font-semibold text-[#1B1C1C]">{mod.module_name}</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {mod.LESSONS.map((lesson) => (
                    <button
                      key={lesson.lesson_id}
                      onClick={() => setSelectedLesson(lesson)}
                      className="flex flex-col items-start gap-3 rounded-xl border border-border bg-white p-4 text-left shadow-[0_4px_20px_0_rgba(0,0,0,0.05)] transition-shadow hover:shadow-[0_4px_20px_0_rgba(0,0,0,0.1)]"
                    >
                      <div className="flex size-10 items-center justify-center rounded-xl bg-[rgba(0,101,141,0.1)]">
                        <span className="material-symbols-rounded text-lg text-[#3db9ee]">
                          {contentTypes[lesson.content_type] || "description"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-[#1B1C1C]">{lesson.description}</span>
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {lesson.content_type}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedLesson && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedLesson(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-border bg-white shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">{selectedLesson.description}</h2>
              <button
                onClick={() => setSelectedLesson(null)}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
              >
                <span className="material-symbols-rounded text-lg">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {selectedLesson.content_url ? (
                <LessonViewer lesson={selectedLesson} />
              ) : (
                <div className="flex items-center justify-center py-16 text-center">
                  <span className="material-symbols-rounded text-3xl text-muted-foreground/50">link_off</span>
                  <p className="mt-2 text-sm text-muted-foreground">No content available for this resource.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
