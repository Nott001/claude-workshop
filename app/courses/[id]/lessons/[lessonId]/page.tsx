"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

interface Lesson {
  lesson_id: number;
  module_id: number;
  description: string;
  content_type: string;
  content_url: string;
  total_units: number;
  sequence_order: number;
}

interface ProgressEntry {
  lesson_id: number;
  user_id: number;
  units_completed: number;
  is_completed: boolean;
}

export default function LessonViewerPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;
  const lessonId = params.lessonId as string;
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [progress, setProgress] = useState<ProgressEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unitsInput, setUnitsInput] = useState("0");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const res = await fetch(`/api/lessons/${lessonId}`);
      if (!res.ok) {
        if (!cancelled) setError("Lesson not found");
        setLoading(false);
        return;
      }
      const data: Lesson = await res.json();
      if (cancelled) return;
      setLesson(data);
      setUnitsInput(String(Math.min(1, data.total_units)));
      setLoading(false);

      const progRes = await fetch(`/api/courses/${courseId}/progress`);
      if (progRes.ok) {
        const progData = await progRes.json();
        const prog = progData.progress?.find((p: ProgressEntry) => p.lesson_id === Number(lessonId));
        if (prog && !cancelled) {
          setProgress(prog);
          setUnitsInput(String(prog.units_completed));
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [courseId, lessonId]);

  async function handleUpdateProgress() {
    if (!lesson) return;
    const units = Number(unitsInput);
    if (units < 0 || units > lesson.total_units) return;

    const res = await fetch(`/api/lessons/${lessonId}/progress`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ units_completed: units }),
    });

    if (res.ok) {
      const updated: ProgressEntry = await res.json();
      setProgress(updated);
    }
  }

  function renderContent() {
    if (!lesson) return null;
    switch (lesson.content_type) {
      case "pdf":
        return <iframe src={lesson.content_url} title={lesson.description} />;
      case "video":
        return <video controls src={lesson.content_url} />;
      case "image":
        return <img src={lesson.content_url} alt={lesson.description} />;
      case "link":
        return (
          <a href={lesson.content_url} target="_blank" rel="noopener noreferrer">
            Open {lesson.description}
          </a>
        );
      default:
        return <p>Unsupported content type: {lesson.content_type}</p>;
    }
  }

  if (loading) return <div>Loading lesson...</div>;
  if (error || !lesson) return <div>{error ?? "Lesson not found"}</div>;

  return (
    <div>
      <button onClick={() => router.push(`/courses/${courseId}`)}>&larr; Back to Course</button>
      <h1>{lesson.description}</h1>
      <p>
        Type: {lesson.content_type} | Total Units: {lesson.total_units}
      </p>

      <hr />

      <div>{renderContent()}</div>

      <hr />

      <h2>Progress</h2>
      <p>
        Completed: {progress?.units_completed ?? 0} / {lesson.total_units}
        {progress?.is_completed ? " (Complete!)" : ""}
      </p>
      <div>
        <label>Units completed:</label>
        <input
          type="number"
          value={unitsInput}
          onChange={(e) => setUnitsInput(e.target.value)}
          min="0"
          max={lesson.total_units}
        />
        <button onClick={handleUpdateProgress}>Update</button>
      </div>
    </div>
  );
}
