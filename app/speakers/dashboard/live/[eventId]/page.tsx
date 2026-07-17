"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EventSessionNavbar } from "@/components/event-session-navbar";
import { SessionStats } from "@/components/session-stats";
import { CourseSyllabus, type ModuleStatus } from "@/components/course-syllabus";
import { ResourceCard } from "@/components/resource-card";
import { QALiveFeed } from "@/components/qa-live-feed";

interface Module {
  id: number;
  title: string;
  description: string;
  status: ModuleStatus;
  duration?: string;
}

interface Resource {
  id: number;
  title: string;
  type: "pdf" | "link" | "video";
  size?: string;
  url?: string;
}

interface Question {
  id: number;
  authorName: string;
  authorAvatar?: string;
  text: string;
  timestamp: string;
  isNew: boolean;
}

interface SessionData {
  eventName: string;
  progressPercent: number;
  activeParticipants: number;
  modules: Module[];
  resources: Resource[];
  questions: Question[];
  newQuestionCount: number;
  startedAt: string;
  durationMinutes: number;
}

function computeElapsed(startedAt: string): string {
  const diff = Date.now() - new Date(startedAt).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function computeRemaining(startedAt: string, durationMinutes: number): string {
  const end = new Date(startedAt).getTime() + durationMinutes * 60000;
  const diff = Math.max(0, end - Date.now());
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function LiveEventSessionPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [session, setSession] = useState<SessionData | null>(null);
  const [elapsed, setElapsed] = useState("00:00:00");
  const [remaining, setRemaining] = useState("00:00:00");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchSession() {
      const res = await fetch(`/api/speakers/me/events/${eventId}/live`);
      if (!res.ok) {
        if (!cancelled) setLoading(false);
        return;
      }
      const data = await res.json();
      if (!cancelled) {
        setSession(data);
        setLoading(false);
      }
    }

    fetchSession();
    return () => { cancelled = true; };
  }, [eventId]);

  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => {
      setElapsed(computeElapsed(session.startedAt));
      setRemaining(computeRemaining(session.startedAt, session.durationMinutes));
    }, 1000);
    return () => clearInterval(id);
  }, [session]);

  function handleExit() {
    router.push("/speakers/dashboard");
  }

  function handleMarkComplete(moduleId: number) {
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        modules: prev.modules.map((m) =>
          m.id === moduleId ? { ...m, status: "completed" as const } : m
        ),
      };
    });
  }

  function handleAnswer(questionId: number) {
    setSession((prev) => {
      if (!prev) return prev;
      const q = prev.questions.find((q) => q.id === questionId);
      return {
        ...prev,
        questions: prev.questions.filter((q) => q.id !== questionId),
        newQuestionCount: q?.isNew ? prev.newQuestionCount - 1 : prev.newQuestionCount,
      };
    });
  }

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fbf9f8]">
        <div className="text-sm text-[#5f5e5e]">Loading session...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#fbf9f8]">
      <EventSessionNavbar
        eventName={session.eventName}
        elapsed={elapsed}
        remaining={remaining}
        onExit={handleExit}
      />

      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-16 pt-24 pb-12">
        <SessionStats
          progressPercent={session.progressPercent}
          activeParticipants={session.activeParticipants}
        />

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-8 flex flex-col gap-6">
            <CourseSyllabus
              modules={session.modules}
              onMarkComplete={handleMarkComplete}
            />

            <div className="rounded-xl border border-[#bdc8d0] bg-white p-6 shadow-[0_4px_10px_rgba(0,0,0,0.05)]">
              <div className="mb-6 flex items-center justify-between">
                <span className="text-[20px] leading-[30px] text-[#1b1c1c]">Session Resources</span>
                <button className="flex items-center gap-1 text-base font-bold text-[#3db9ee]">
                  <span className="material-symbols-rounded text-[14px]">add</span>
                  Add Resource
                </button>
              </div>
              <div className="flex gap-4">
                {session.resources.map((r) => (
                  <ResourceCard
                    key={r.id}
                    title={r.title}
                    type={r.type}
                    size={r.size}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="col-span-4">
            <QALiveFeed
              questions={session.questions}
              newCount={session.newQuestionCount}
              onAnswer={handleAnswer}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
