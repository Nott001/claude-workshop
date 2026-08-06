import { describe, it, expect } from "vitest";
import { courseSchema, moduleSchema, lessonSchema, contentTypes, getContentTypeLabel } from "@/modules/courses/lib/schemas";
import type { Course, Module, Lesson, ContentType } from "@/shared/types";

describe("Course content types", () => {
  it("supports all content types", () => {
    const types: ContentType[] = ["pdf", "video", "image", "link"];
    expect(contentTypes).toEqual(types);
  });

  it("getContentTypeLabel returns uppercase", () => {
    expect(getContentTypeLabel("pdf")).toBe("PDF");
    expect(getContentTypeLabel("video")).toBe("VIDEO");
  });

  it("Course interface has correct shape", () => {
    const course: Course = {
      id: 1,
      event_id: 1,
      course_name: "Test Course",
      course_description: "A description",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    expect(course.id).toBe(1);
    expect(course.course_name).toBe("Test Course");
  });

  it("Module interface has correct shape", () => {
    const mod: Module = {
      id: 1,
      course_id: 1,
      module_name: "Test Module",
      sequence_order: 1,
      module_type: "lessons",
      is_locked: false,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    expect(mod.module_name).toBe("Test Module");
    expect(mod.sequence_order).toBe(1);
  });

  it("Lesson interface has correct shape", () => {
    const lesson: Lesson = {
      id: 1,
      module_id: 1,
      description: "Test Lesson",
      content_type: "pdf",
      content_url: "https://example.com/doc.pdf",
      sequence_order: 1,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    expect(lesson.content_type).toBe("pdf");
    expect(lesson.sequence_order).toBe(1);
  });
});

describe("courseSchema", () => {
  it("accepts valid course data", () => {
    const result = courseSchema.safeParse({ course_name: "Intro to React", event_id: 1 });
    expect(result.success).toBe(true);
  });

  it("accepts course with description", () => {
    const result = courseSchema.safeParse({ course_name: "Intro", course_description: "Desc", event_id: 1 });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = courseSchema.safeParse({ course_name: "", event_id: 1 });
    expect(result.success).toBe(false);
  });

  it("rejects name over 255 chars", () => {
    const result = courseSchema.safeParse({ course_name: "a".repeat(256), event_id: 1 });
    expect(result.success).toBe(false);
  });

  it("rejects missing event_id", () => {
    const result = courseSchema.safeParse({ course_name: "Intro" });
    expect(result.success).toBe(false);
  });
});

describe("moduleSchema", () => {
  it("accepts valid module data", () => {
    const result = moduleSchema.safeParse({ module_name: "Module 1", sequence_order: "1" });
    expect(result.success).toBe(true);
  });

  it("rejects negative sequence order", () => {
    const result = moduleSchema.safeParse({ module_name: "Module 1", sequence_order: "0" });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = moduleSchema.safeParse({ module_name: "", sequence_order: "1" });
    expect(result.success).toBe(false);
  });
});

describe("lessonSchema", () => {
  it("accepts valid lesson data", () => {
    const result = lessonSchema.safeParse({
      description: "Lesson 1",
      content_type: "pdf",
      content_url: "https://example.com/doc.pdf",
      sequence_order: "1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all content types", () => {
    for (const ct of ["pdf", "video", "image", "link"]) {
      const result = lessonSchema.safeParse({
        description: "Lesson",
        content_type: ct,
        content_url: "https://example.com/doc",
        sequence_order: "1",
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid content type", () => {
    const result = lessonSchema.safeParse({
      description: "Lesson",
      content_type: "audio",
      content_url: "https://example.com/doc",
      sequence_order: "1",
    });
    expect(result.success).toBe(false);
  });

  it("accepts relative or invalid URL (storage proxy path)", () => {
    const result = lessonSchema.safeParse({
      description: "Lesson",
      content_type: "pdf",
      content_url: "not-a-url",
      sequence_order: "1",
    });
    expect(result.success).toBe(true);
  });
});
