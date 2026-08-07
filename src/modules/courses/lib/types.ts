import type { Module, Lesson } from "@/shared/types";

export interface ModuleSpeakerProfile {
  id: number;
  designation: string | null;
  USER: { full_name: string } | null;
}

export interface ModuleWithLessons extends Module {
  LESSONS: Lesson[];
  SPEAKER_PROFILE?: ModuleSpeakerProfile | null;
}

/** The builder's prop shape for the event's assigned speakers. */
export interface CourseSpeaker {
  speaker_profile_id: number;
  full_name: string;
}
