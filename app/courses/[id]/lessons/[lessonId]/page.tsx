"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { Lesson } from "@/types";

function ContentRenderer({ lesson }: { lesson: Lesson }) {
  switch (lesson.content_type) {
    case "pdf":
      return (
        <div className="flex h-[80vh] flex-col items-center justify-center gap-4 rounded-lg border bg-muted/30">
          <iframe src={lesson.content_url} className="h-full w-full rounded-lg" title={lesson.description} />
        </div>
      );
    case "video":
      return (
        <div className="aspect-video rounded-lg bg-black">
          <video src={lesson.content_url} controls className="h-full w-full rounded-lg">
            <p>Your browser does not support the video element.</p>
          </video>
        </div>
      );
    case "image":
      return (
        <div className="flex items-center justify-center rounded-lg bg-muted/30 p-4">
          <img src={lesson.content_url} alt={lesson.description} className="max-h-[70vh] rounded-lg object-contain" />
        </div>
      );
    case "link":
      return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-muted/30 p-8">
          <p className="text-muted-foreground text-sm">External Resource</p>
          <a
            href={lesson.content_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary break-all text-lg underline underline-offset-4 hover:text-primary/80"
          >
            {lesson.content_url}
          </a>
        </div>
      );
  }
}

export default function LessonViewerPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;
  const lessonId = params.lessonId as string;
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [progress, setProgress] = useState<{ units_completed: number; is_completed: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/lessons/${lessonId}`);
      if (!res.ok) return;
      const data = await res.json();
      setLesson(data);
      setLoading(false);

      const progRes = await fetch(`/api/courses/${courseId}/progress`);
      if (progRes.ok) {
        const progData = await progRes.json();
        if (progData.myUserId) {
          const myProg = progData.progress?.find((p: { lesson_id: number }) => p.lesson_id === data.lesson_id);
          setProgress(myProg ?? null);
        }
      }
    }
    load();
  }, [lessonId, courseId]);

  async function incrementProgress() {
    if (!lesson) return;
    const current = progress?.units_completed ?? 0;
    if (current >= lesson.total_units) return;

    const res = await fetch(`/api/lessons/${lessonId}/progress`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ units_completed: current + 1 }),
    });

    if (res.ok) {
      const updated = await res.json();
      setProgress(updated);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <p className="text-muted-foreground">Loading lesson...</p>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <p className="text-destructive">Lesson not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push(`/courses/${courseId}`)}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-8">
      <Button variant="ghost" className="mb-4" onClick={() => router.push(`/courses/${courseId}`)}>
        &larr; Back to Course
      </Button>

      <div className="mb-6">
        <h1 className="text-foreground text-3xl font-bold">{lesson.description}</h1>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-muted-foreground rounded bg-muted px-2 py-0.5 text-xs">
            {lesson.content_type.toUpperCase()}
          </span>
          <span className="text-muted-foreground text-sm">
            {progress?.units_completed ?? 0} / {lesson.total_units} units completed
          </span>
          {progress?.is_completed && (
            <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900 dark:text-green-300">
              Completed
            </span>
          )}
        </div>
      </div>

      <div className="mb-6">
        <ContentRenderer lesson={lesson} />
      </div>

      <div className="flex items-center gap-4">
        <Button onClick={incrementProgress} disabled={progress?.is_completed}>
          {progress?.is_completed ? "Completed" : "Mark Unit Complete"}
        </Button>
        {progress?.is_completed && <p className="text-sm text-green-600">All units completed!</p>}
      </div>
    </div>
  );
}
