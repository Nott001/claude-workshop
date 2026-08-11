import type { Lesson } from "@/shared/types";
import { findLiveModule } from "@/shared/lib/live-module";
import type { ModuleWithLessons } from "@/modules/courses/lib/types";

export interface CurrentTopic {
  lesson: Lesson;
  moduleName: string;
  startTime: string | null;
  endTime: string | null;
  speakerName: string | null;
}

/**
 * The lesson the room should point everyone at: the speaker's explicit
 * highlight when there is one, otherwise the first lesson of the module that
 * is live right now. The highlight wins even when it names a module that is
 * not the one on schedule; the live-module fallback never reaches into a Q&A
 * module, which has no lessons. Null when neither source has a lesson.
 */
export function resolveCurrentTopic(
  modules: ModuleWithLessons[],
  eventDate: string,
  highlightedLessonId: number | null,
  now: Date,
): CurrentTopic | null {
  if (highlightedLessonId != null) {
    for (const mod of modules) {
      const lesson = mod.LESSONS.find((l) => l.id === highlightedLessonId);
      if (lesson) return toCurrentTopic(mod, lesson);
    }
    return null;
  }

  const live = findLiveModule(modules, eventDate, now);
  if (!live) return null;
  const liveModule = modules.find((m) => m.id === live.id);
  if (!liveModule) return null;
  const firstLesson = [...liveModule.LESSONS].sort((a, b) => a.sequence_order - b.sequence_order)[0];
  if (!firstLesson) return null;
  return toCurrentTopic(liveModule, firstLesson);
}

function toCurrentTopic(mod: ModuleWithLessons, lesson: Lesson): CurrentTopic {
  return {
    lesson,
    moduleName: mod.module_name,
    startTime: mod.start_time,
    endTime: mod.end_time,
    speakerName: mod.SPEAKER_PROFILE?.USER?.full_name ?? null,
  };
}
