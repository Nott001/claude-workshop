"use client";

import { useEffect, useState, useRef } from "react";
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
  const [contentFile, setContentFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [totalUnits, setTotalUnits] = useState("1");
  const [seqOrder, setSeqOrder] = useState("1");
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setContentFile(null);
    setTotalUnits("1");
    setSeqOrder("1");
    setEditingLesson(null);
  }

  function fillEdit(lesson: Lesson) {
    setEditingLesson(lesson);
    setDesc(lesson.description);
    setContentType(lesson.content_type);
    setContentUrl(lesson.content_url);
    setContentFile(null);
    setTotalUnits(String(lesson.total_units));
    setSeqOrder(String(lesson.sequence_order));
  }

  function getFileAcceptForType(type: string): string {
    switch (type) {
      case "pdf":
        return "application/pdf";
      case "video":
        return "video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska";
      case "image":
        return "image/jpeg,image/png";
      default:
        return "";
    }
  }

  function getUploadEndpoint(type: string): string | null {
    if (type === "video") return "/api/upload/course-video";
    if (type === "pdf" || type === "image") return "/api/upload/course-asset";
    return null;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const body = {
      description: desc,
      content_type: contentType,
      content_url: contentFile ? undefined : contentUrl || undefined,
      total_units: Number(totalUnits),
      sequence_order: Number(seqOrder),
    };

    let res: Response;
    let lessonId: number;

    if (editingLesson) {
      res = await fetch(`/api/lessons/${editingLesson.lesson_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      lessonId = editingLesson.lesson_id;
    } else {
      res = await fetch(`/api/modules/${moduleId}/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return;
      const created = await res.json();
      lessonId = created.lesson_id;
    }

    if (!res.ok) return;

    if (contentFile) {
      const endpoint = getUploadEndpoint(contentType);
      if (endpoint) {
        setUploading(true);
        const formData = new FormData();
        formData.append("file", contentFile);
        formData.append("lesson_id", String(lessonId));
        formData.append("course_id", courseId);
        formData.append("module_id", moduleId);

        const uploadRes = await fetch(endpoint, {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          setError("Lesson saved but file upload failed. You can re-edit to upload again.");
          setUploading(false);
          resetForm();
          await loadModule();
          return;
        }
        setUploading(false);
      }
    }

    resetForm();
    await loadModule();
  }

  async function handleDelete(lessonId: number) {
    if (!confirm("Delete this lesson?")) return;
    const res = await fetch(`/api/lessons/${lessonId}`, { method: "DELETE" });
    if (!res.ok) return;
    await loadModule();
  }

  async function loadModule() {
    const res = await fetch(`/api/courses/${courseId}`);
    if (!res.ok) return;
    const data: CourseDetail = await res.json();
    setCourse(data);
    const mod = data.MODULES.find((m) => m.module_id === Number(moduleId));
    if (mod) setModule(mod);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setContentFile(file);
      setContentUrl("");
    }
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
      {error && <p>{error}</p>}
      <form onSubmit={handleSave}>
        <div>
          <label>Description</label>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} required />
        </div>
        <div>
          <label>Content Type</label>
          <select
            value={contentType}
            onChange={(e) => {
              setContentType(e.target.value);
              setContentFile(null);
            }}
          >
            <option value="pdf">PDF</option>
            <option value="video">Video</option>
            <option value="image">Image</option>
            <option value="link">Link</option>
          </select>
        </div>
        <div>
          <label>Content</label>
          {contentType !== "link" && (
            <>
              <input ref={fileInputRef} type="file" accept={getFileAcceptForType(contentType)} onChange={handleFileChange} />
              {contentFile && <p>Selected: {contentFile.name}</p>}
            </>
          )}
          <input
            value={contentUrl}
            onChange={(e) => {
              setContentUrl(e.target.value);
              setContentFile(null);
            }}
            placeholder={contentType === "link" ? "https://..." : "Or paste URL"}
            required={contentType === "link" && !contentFile}
          />
        </div>
        <div>
          <label>Total Units</label>
          <input type="number" value={totalUnits} onChange={(e) => setTotalUnits(e.target.value)} min="1" required />
        </div>
        <div>
          <label>Sequence Order</label>
          <input type="number" value={seqOrder} onChange={(e) => setSeqOrder(e.target.value)} min="1" required />
        </div>
        <button type="submit" disabled={uploading}>
          {uploading ? "Uploading..." : editingLesson ? "Update" : "Create"}
        </button>
        {editingLesson && (
          <button type="button" onClick={resetForm}>
            Cancel
          </button>
        )}
      </form>
    </div>
  );
}
