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

interface Module {
  module_id: number;
  module_name: string;
  sequence_order: number;
  LESSONS: Lesson[];
}

interface CourseDetail {
  course_id: number;
  course_name: string;
  MODULES: Module[];
}

export default function ModuleEditorPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;
  const moduleId = params.moduleId as string;
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [module, setModule] = useState<Module | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [desc, setDesc] = useState("");
  const [contentType, setContentType] = useState("pdf");
  const [contentUrl, setContentUrl] = useState("");
  const [totalUnits, setTotalUnits] = useState("1");
  const [seqOrder, setSeqOrder] = useState("1");
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const res = await fetch(`/api/courses/${courseId}`);
      if (!res.ok) {
        if (!cancelled) setError("Failed to load course");
        setLoading(false);
        return;
      }
      const data: CourseDetail = await res.json();
      if (cancelled) return;
      setCourse(data);
      const mod = data.MODULES.find((m) => m.module_id === Number(moduleId));
      if (!mod) {
        setError("Module not found");
        setLoading(false);
        return;
      }
      setModule(mod);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [courseId, moduleId]);

  function resetForm() {
    setDesc("");
    setContentType("pdf");
    setContentUrl("");
    setTotalUnits("1");
    setSeqOrder("1");
    setEditingLesson(null);
  }

  function fillEdit(lesson: Lesson) {
    setEditingLesson(lesson);
    setDesc(lesson.description);
    setContentType(lesson.content_type);
    setContentUrl(lesson.content_url);
    setTotalUnits(String(lesson.total_units));
    setSeqOrder(String(lesson.sequence_order));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      description: desc,
      content_type: contentType,
      content_url: contentUrl,
      total_units: Number(totalUnits),
      sequence_order: Number(seqOrder),
    };

    let res: Response;
    if (editingLesson) {
      res = await fetch(`/api/lessons/${editingLesson.lesson_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      res = await fetch(`/api/modules/${moduleId}/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    if (!res.ok) return;
    resetForm();
    await loadModule();
  }

  async function handleDelete(lessonId: number) {
    if (!confirm("Delete this lesson?")) return;
    const res = await fetch(`/api/lessons/${lessonId}`, { method: "DELETE" });
    if (!res.ok) return;
    await loadModule();
  }

  if (loading) return <div>Loading module...</div>;
  if (error || !module) return <div>{error ?? "Module not found"}</div>;

  return (
    <div>
      <button onClick={() => router.push(`/courses/${courseId}`)}>&larr; Back to Course</button>
      <h1>
        {course?.course_name} / {module.module_name}
      </h1>

      <hr />

      <h2>Lessons</h2>
      {module.LESSONS.length === 0 ? (
        <p>No lessons yet.</p>
      ) : (
        <ul>
          {module.LESSONS.map((lesson) => (
            <li key={lesson.lesson_id}>
              <span>
                #{lesson.sequence_order} {lesson.description} ({lesson.content_type})
              </span>
              <button onClick={() => fillEdit(lesson)}>Edit</button>
              <button onClick={() => handleDelete(lesson.lesson_id)}>Delete</button>
            </li>
          ))}
        </ul>
      )}

      <hr />

      <h2>{editingLesson ? "Edit Lesson" : "Create Lesson"}</h2>
      <form onSubmit={handleSave}>
        <div>
          <label>Description</label>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} required />
        </div>
        <div>
          <label>Content Type</label>
          <select value={contentType} onChange={(e) => setContentType(e.target.value)}>
            <option value="pdf">PDF</option>
            <option value="video">Video</option>
            <option value="image">Image</option>
            <option value="link">Link</option>
          </select>
        </div>
        <div>
          <label>Content URL</label>
          <input value={contentUrl} onChange={(e) => setContentUrl(e.target.value)} required />
        </div>
        <div>
          <label>Total Units</label>
          <input type="number" value={totalUnits} onChange={(e) => setTotalUnits(e.target.value)} min="1" required />
        </div>
        <div>
          <label>Sequence Order</label>
          <input type="number" value={seqOrder} onChange={(e) => setSeqOrder(e.target.value)} min="1" required />
        </div>
        <button type="submit">{editingLesson ? "Update" : "Create"}</button>
        {editingLesson && (
          <button type="button" onClick={resetForm}>
            Cancel
          </button>
        )}
      </form>
    </div>
  );
}
