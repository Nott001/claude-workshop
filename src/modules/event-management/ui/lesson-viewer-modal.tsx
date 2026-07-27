"use client";

import LessonViewer from "@/components/lesson-viewer";

interface Lesson {
  id: number;
  module_id: number;
  description: string;
  content_type: string;
  content_url: string | null;
  sequence_order: number;
}

interface LessonViewerModalProps {
  lesson: Lesson | null;
  onClose: () => void;
}

export function LessonViewerModal({ lesson, onClose }: LessonViewerModalProps) {
  if (!lesson) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-2" onClick={onClose}>
      <div
        className="flex h-full w-full max-h-[98vh] max-w-[98vw] flex-col rounded-xl border border-border bg-surface shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">{lesson.description}</h2>
          <div className="flex items-center gap-2">
            <a
              href={lesson.content_url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
              title="Open in new tab"
            >
              <span className="material-symbols-rounded text-lg">open_in_new</span>
            </a>
            <button
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <span className="material-symbols-rounded text-lg">close</span>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6">
          {lesson.content_url ? (
            <LessonViewer lesson={lesson as Lesson & { content_url: string }} />
          ) : (
            <div className="flex items-center justify-center py-16 text-center">
              <span className="material-symbols-rounded text-3xl text-muted-foreground/50">link_off</span>
              <p className="mt-2 text-sm text-muted-foreground">No content available for this resource.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
