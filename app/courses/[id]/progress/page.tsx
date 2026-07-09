"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Lesson {
  lesson_id: number;
  description: string;
  sequence_order: number;
  total_units: number;
}

interface Module {
  module_id: number;
  module_name: string;
  sequence_order: number;
  LESSONS: Lesson[];
}

interface Progress {
  lesson_id: number;
  user_id: number;
  units_completed: number;
  is_completed: boolean;
}

interface UserInfo {
  user_id: number;
  full_name: string;
  email: string;
}

export default function ProgressPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;
  const [modules, setModules] = useState<Module[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFacilitator, setIsFacilitator] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/courses/${courseId}/progress`);
      if (!res.ok) return;
      const data = await res.json();
      setModules(data.modules ?? []);
      setProgress(data.progress ?? []);
      setIsFacilitator(!!data.users);
      if (data.users) {
        setUsers(data.users);
        setSelectedUserId(data.users[0]?.user_id ?? null);
      } else {
        setMyUserId(data.myUserId);
      }
      setLoading(false);
    }
    load();
  }, [courseId]);

  function getProgressForUser(userId: number): Progress[] {
    return progress.filter((p) => p.user_id === userId);
  }

  function getProgressForLesson(lessonId: number, userId: number): Progress | undefined {
    return progress.find((p) => p.lesson_id === lessonId && p.user_id === userId);
  }

  function calcTotalUnits(): number {
    return modules.reduce((sum, m) => sum + m.LESSONS.reduce((s, l) => s + l.total_units, 0), 0);
  }

  function calcCompletedUnits(userId: number): number {
    const userProg = getProgressForUser(userId);
    return userProg.reduce((sum, p) => sum + p.units_completed, 0);
  }

  const effectiveUserId = isFacilitator ? selectedUserId : myUserId;

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <p className="text-muted-foreground">Loading progress...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <Button variant="ghost" className="mb-4" onClick={() => router.push(`/courses/${courseId}`)}>
        &larr; Back to Course
      </Button>

      <div className="mb-6">
        <h1 className="text-foreground text-3xl font-bold">Progress</h1>
        {isFacilitator && (
          <div className="mt-4">
            <label className="text-sm font-medium">Select Attendee</label>
            <select
              className="mt-1 block w-full max-w-xs rounded-md border p-2 text-sm"
              value={selectedUserId ?? ""}
              onChange={(e) => setSelectedUserId(Number(e.target.value))}
            >
              {users.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.full_name} ({u.email})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {effectiveUserId !== null && (
        <div className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Overall Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${calcTotalUnits() > 0 ? (calcCompletedUnits(effectiveUserId) / calcTotalUnits()) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-muted-foreground text-sm">
                  {calcCompletedUnits(effectiveUserId)} / {calcTotalUnits()} units
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="space-y-6">
        {modules.map((mod) => (
          <Card key={mod.module_id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">#{mod.sequence_order}</span>
                {mod.module_name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {mod.LESSONS.map((lesson) => {
                  const p = effectiveUserId !== null ? getProgressForLesson(lesson.lesson_id, effectiveUserId) : undefined;
                  return (
                    <div key={lesson.lesson_id} className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <span className="font-medium">
                          #{lesson.sequence_order} {lesson.description}
                        </span>
                        <span className="text-muted-foreground ml-2 text-sm">
                          ({p?.units_completed ?? 0}/{lesson.total_units})
                        </span>
                      </div>
                      {p?.is_completed ? (
                        <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900 dark:text-green-300">
                          Done
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">In progress</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
