"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormLabel } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";

export default function NewCoursePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        course_name: name,
        course_description: description || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error?.message ?? "Failed to create course");
      setSubmitting(false);
      return;
    }

    const course = await res.json();
    router.push(`/courses/${course.course_id}`);
  }

  return (
    <div className="flex flex-1 flex-col p-5">
      <div className="mb-4">
        <button
          onClick={() => router.push("/courses")}
          className="mb-4 flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="material-symbols-rounded text-[16px]">arrow_back</span>
          Back to Courses
        </button>
        <h1 className="text-base font-bold text-foreground">
          Create new course
        </h1>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Form onSubmit={handleSubmit} className="max-w-lg space-y-4">
        <FormField>
          <FormLabel>Course title</FormLabel>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Digital Strategy 101"
            required
          />
        </FormField>

        <FormField>
          <FormLabel>Description</FormLabel>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What will attendees learn?"
            className="min-h-[80px] resize-y"
          />
        </FormField>

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={submitting}>
            <span className="material-symbols-rounded text-[16px]">
              {submitting ? "hourglass_top" : "add_circle"}
            </span>
            {submitting ? "Creating..." : "Create course"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/courses")}
          >
            Cancel
          </Button>
        </div>
      </Form>
    </div>
  );
}
