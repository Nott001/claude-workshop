"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/dialog";
import LessonViewer from "@/modules/courses/components/lesson-viewer";

interface LessonViewerModalProps {
  lesson: { id: number; description: string; content_type: string; content_url: string | null } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function lessonContentTypeIcon(contentType: string): string {
  switch (contentType) {
    case "pdf":
      return "picture_as_pdf";
    case "video":
      return "play_circle";
    case "image":
      return "image";
    case "link":
      return "link";
    default:
      return "description";
  }
}

export function LessonViewerModal({ lesson, open, onOpenChange }: LessonViewerModalProps) {
  if (!lesson?.content_url) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{lesson.description}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto" style={{ minHeight: "50vh" }}>
          <LessonViewer
            lesson={{
              lesson_id: lesson.id,
              description: lesson.description,
              content_type: lesson.content_type,
              content_url: lesson.content_url,
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
