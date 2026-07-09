"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormField, FormLabel } from "@/components/ui/form";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { PlusIcon, PencilIcon, Trash2Icon } from "lucide-react";
import type { ContentType } from "@/types";

interface Lesson {
  lesson_id: number;
  module_id: number;
  description: string;
  content_type: ContentType;
  content_url: string;
  total_units: number;
  sequence_order: number;
}

interface ModuleDetail {
  module_id: number;
  module_name: string;
  sequence_order: number;
  course_id: number;
  LESSONS: Lesson[];
}

const contentTypes: ContentType[] = ["pdf", "video", "image", "link"];

export default function ModuleEditorPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;
  const moduleId = params.moduleId as string;
  const [mod, setMod] = useState<ModuleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [description, setDescription] = useState("");
  const [contentType, setContentType] = useState<ContentType>("pdf");
  const [contentUrl, setContentUrl] = useState("");
  const [totalUnits, setTotalUnits] = useState("1");
  const [sequenceOrder, setSequenceOrder] = useState("1");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch(`/api/courses/${courseId}`);
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const courseData = await res.json();
      const found = courseData.MODULES.find((m: { module_id: number }) => String(m.module_id) === moduleId);
      setMod(found ?? null);
      setLoading(false);
    }
    load();
  }, [courseId, moduleId]);

  async function reloadModule() {
    const res = await fetch(`/api/courses/${courseId}`);
    if (!res.ok) return;
    const courseData = await res.json();
    const found = courseData.MODULES.find((m: { module_id: number }) => String(m.module_id) === moduleId);
    setMod(found ?? null);
  }

  function resetForm() {
    setDescription("");
    setContentType("pdf");
    setContentUrl("");
    setTotalUnits("1");
    setSequenceOrder("1");
    setEditingLesson(null);
  }

  function openCreate() {
    resetForm();
    setLessonDialogOpen(true);
  }

  function openEdit(lesson: Lesson) {
    setEditingLesson(lesson);
    setDescription(lesson.description);
    setContentType(lesson.content_type);
    setContentUrl(lesson.content_url);
    setTotalUnits(String(lesson.total_units));
    setSequenceOrder(String(lesson.sequence_order));
    setLessonDialogOpen(true);
  }

  async function handleSaveLesson(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      description,
      content_type: contentType,
      content_url: contentUrl,
      total_units: Number(totalUnits),
      sequence_order: Number(sequenceOrder),
    };

    if (editingLesson) {
      await fetch(`/api/lessons/${editingLesson.lesson_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch(`/api/modules/${moduleId}/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    setLessonDialogOpen(false);
    resetForm();
    await reloadModule();
  }

  async function handleDeleteLesson(lessonId: number) {
    if (!confirm("Delete this lesson?")) return;
    await fetch(`/api/lessons/${lessonId}`, { method: "DELETE" });
    await reloadModule();
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <p className="text-muted-foreground">Loading module...</p>
      </div>
    );
  }

  if (!mod) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <p className="text-destructive">Module not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push(`/courses/${courseId}`)}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <Button variant="ghost" className="mb-4" onClick={() => router.push(`/courses/${courseId}`)}>
        &larr; Back to Course
      </Button>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-3xl font-bold">{mod.module_name}</h1>
          <p className="text-muted-foreground mt-1">Sequence #{mod.sequence_order}</p>
        </div>
        <Dialog open={lessonDialogOpen} onOpenChange={setLessonDialogOpen}>
          <DialogTrigger render={<Button onClick={openCreate}><PlusIcon className="mr-1 size-4" /> Add Lesson</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingLesson ? "Edit Lesson" : "Add Lesson"}</DialogTitle>
            </DialogHeader>
            <Form onSubmit={handleSaveLesson}>
              <FormField>
                <FormLabel>Description</FormLabel>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} required />
              </FormField>
              <FormField>
                <FormLabel>Content Type</FormLabel>
                <Select value={contentType} onValueChange={(v) => setContentType(v as ContentType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {contentTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField>
                <FormLabel>Content URL</FormLabel>
                <Input type="url" value={contentUrl} onChange={(e) => setContentUrl(e.target.value)} required />
              </FormField>
              <FormField>
                <FormLabel>Total Units</FormLabel>
                <Input type="number" value={totalUnits} onChange={(e) => setTotalUnits(e.target.value)} min="1" required />
              </FormField>
              <FormField>
                <FormLabel>Sequence Order</FormLabel>
                <Input
                  type="number"
                  value={sequenceOrder}
                  onChange={(e) => setSequenceOrder(e.target.value)}
                  min="1"
                  required
                />
              </FormField>
              <Button type="submit" className="mt-4">
                {editingLesson ? "Update" : "Save"}
              </Button>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {mod.LESSONS.length === 0 ? (
        <p className="text-muted-foreground">No lessons in this module yet.</p>
      ) : (
        <div className="space-y-3">
          {mod.LESSONS.map((lesson) => (
            <Card key={lesson.lesson_id}>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground text-sm">#{lesson.sequence_order}</span>
                  <CardTitle className="text-base">{lesson.description}</CardTitle>
                  <span className="text-muted-foreground rounded bg-muted px-1.5 py-0.5 text-xs">
                    {lesson.content_type.toUpperCase()}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {lesson.total_units} unit{lesson.total_units > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(lesson)}>
                    <PencilIcon className="size-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteLesson(lesson.lesson_id)}>
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
