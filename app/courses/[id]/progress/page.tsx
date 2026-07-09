"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface Module {
  module_id: number;
  module_name: string;
  sequence_order: number;
  LESSONS: { lesson_id: number; description: string; sequence_order: number }[];
}

interface User {
  user_id: number;
  full_name: string;
  email: string;
}

interface ProgressEntry {
  lesson_id: number;
  user_id: number;
  units_completed: number;
  is_completed: boolean;
}

interface ProgressData {
  modules: Module[];
  progress: ProgressEntry[];
  users?: User[];
  myUserId?: number;
}

export default function ProgressPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch(`/api/courses/${courseId}/progress`);
      if (!res.ok) {
        setError("Failed to load progress");
        setLoading(false);
        return;
      }
      const json: ProgressData = await res.json();
      setData(json);
      setLoading(false);
    }
    load();
  }, [courseId]);

  if (loading) return <div>Loading progress...</div>;
  if (error || !data) return <div>{error ?? "Failed to load"}</div>;

  const allLessons = data.modules.flatMap((m) => m.LESSONS);

  if (data.users) {
    return (
      <div>
        <button onClick={() => router.push(`/courses/${courseId}`)}>&larr; Back to Course</button>
        <h1>Progress Overview</h1>
        <table>
          <thead>
            <tr>
              <th>Attendee</th>
              {data.modules.map((m) => (
                <th key={m.module_id} colSpan={m.LESSONS.length}>
                  {m.module_name}
                </th>
              ))}
            </tr>
            <tr>
              <th></th>
              {allLessons.map((l) => (
                <th key={l.lesson_id}>{l.description}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.users.map((user) => (
              <tr key={user.user_id}>
                <td>{user.full_name}</td>
                {allLessons.map((lesson) => {
                  const prog = data.progress.find((p) => p.lesson_id === lesson.lesson_id && p.user_id === user.user_id);
                  return (
                    <td key={lesson.lesson_id}>{prog ? `${prog.units_completed}/${prog.is_completed ? "✓" : "—"}` : "—"}</td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => router.push(`/courses/${courseId}`)}>&larr; Back to Course</button>
      <h1>My Progress</h1>
      <table>
        <thead>
          <tr>
            <th>Lesson</th>
            <th>Module</th>
            <th>Progress</th>
          </tr>
        </thead>
        <tbody>
          {allLessons.map((lesson) => {
            const prog = data.progress.find((p) => p.lesson_id === lesson.lesson_id);
            const mod = data.modules.find((m) => m.LESSONS.some((l) => l.lesson_id === lesson.lesson_id));
            return (
              <tr key={lesson.lesson_id}>
                <td>{lesson.description}</td>
                <td>{mod?.module_name ?? "—"}</td>
                <td>{prog ? `${prog.units_completed}/${prog.is_completed ? "✓" : "—"}` : "Not started"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
