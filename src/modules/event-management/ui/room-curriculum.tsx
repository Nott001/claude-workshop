"use client";

interface Lesson {
  id: number;
  module_id: number;
  description: string;
  content_type: string;
  content_url: string | null;
  sequence_order: number;
}

interface Module {
  id: number;
  module_name: string;
  sequence_order: number;
  LESSONS: Lesson[];
}

interface CourseData {
  id: number;
  course_name: string;
  course_description: string | null;
  MODULES: Module[];
}

interface RoomCurriculumProps {
  course: CourseData;
  highlightedLessonId: number | null;
  isStaff: boolean;
  eventStarted: boolean;
  settingHighlight: boolean;
  onSetHighlight: (lessonId: number) => void;
  onClearHighlight: () => void;
  onSelectLesson: (lesson: Lesson) => void;
}

function contentTypeIcon(contentType: string, contentUrl: string | null): string {
  if ((contentType === "video" && contentUrl?.includes("youtube.com")) || contentUrl?.includes("youtu.be")) {
    return "play_circle";
  }
  const icons: Record<string, string> = {
    pdf: "picture_as_pdf",
    video: "smart_display",
    image: "image",
    link: "link",
  };
  return icons[contentType] || "description";
}

export function RoomCurriculum({
  course,
  highlightedLessonId,
  isStaff,
  eventStarted,
  settingHighlight,
  onSetHighlight,
  onClearHighlight,
  onSelectLesson,
}: RoomCurriculumProps) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-fg">{course.course_name}</h1>
        {course.course_description && <p className="mt-1 text-sm text-muted-foreground">{course.course_description}</p>}
      </div>

      {course.MODULES.map((mod, modIdx) => (
        <div key={mod.id}>
          <h2 className="mb-3 text-sm font-semibold text-fg">
            {modIdx + 1}. {mod.module_name}
          </h2>
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-[0_4px_20px_0_rgba(0,0,0,0.05)]">
            {mod.LESSONS.map((lesson, lessonIdx) => {
              const isHighlighted = highlightedLessonId === lesson.id;
              return (
                <div
                  key={lesson.id}
                  className={"relative transition-colors " + (isHighlighted ? "bg-[rgba(0,150,199,0.06)]" : "")}
                >
                  {isHighlighted && <div className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-brand" />}
                  <button
                    onClick={() => onSelectLesson(lesson)}
                    className={
                      "flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted " +
                      (isHighlighted ? "pr-20" : "")
                    }
                  >
                    <span
                      className={
                        "flex size-10 shrink-0 items-center justify-center rounded-xl " +
                        (isHighlighted ? "bg-[rgba(0,150,199,0.15)]" : "bg-[rgba(0,101,141,0.1)]")
                      }
                    >
                      <span className="material-symbols-rounded text-lg text-brand">
                        {isHighlighted ? "radio_button_checked" : contentTypeIcon(lesson.content_type, lesson.content_url)}
                      </span>
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-medium text-fg">
                        <span className="text-muted-foreground">
                          {modIdx + 1}.{lessonIdx + 1}
                        </span>
                        &ensp;{lesson.description}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {lesson.content_type}
                        </span>
                        {isHighlighted && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(0,150,199,0.1)] px-2 py-0.5 text-[10px] font-semibold text-brand">
                            <span className="material-symbols-rounded text-[10px]">visibility</span>
                            Guiding
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                  {isStaff && eventStarted && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      {isHighlighted ? (
                        <button
                          onClick={onClearHighlight}
                          disabled={settingHighlight}
                          className="flex items-center gap-1 rounded-lg border border-[rgba(0,150,199,0.3)] bg-surface px-2.5 py-1.5 text-[10px] font-bold text-brand transition-colors hover:bg-[rgba(0,150,199,0.06)] disabled:opacity-50"
                        >
                          <span className="material-symbols-rounded text-xs">close</span>
                          Clear
                        </button>
                      ) : (
                        <button
                          onClick={() => onSetHighlight(lesson.id)}
                          disabled={settingHighlight}
                          className="flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[10px] font-bold text-muted-fg transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
                        >
                          <span className="material-symbols-rounded text-xs">arrow_right_alt</span>
                          Guide
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
