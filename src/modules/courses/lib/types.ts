import type { Module, Lesson } from "@/shared/types";

export interface ModuleWithLessons extends Module {
  LESSONS: Lesson[];
}
