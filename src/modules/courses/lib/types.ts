import type { Module, Lesson } from "@/shared/types";

export interface ModuleWithLessons extends Module {
  LESSONS: Lesson[];
  start_time?: string | null;
  end_time?: string | null;
  speaker_profile_id?: number | null;
}
