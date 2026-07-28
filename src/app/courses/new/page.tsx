"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Form, FormField, FormLabel } from "@/shared/components/ui/form";
import { Footer } from "@/shared/components/footer";
import { LessonDialog } from "@/modules/courses/ui/lesson-dialog";
import { CurriculumBuilder } from "@/modules/courses/ui/curriculum-builder";
import { useCourseCreate } from "@/modules/courses/lib/use-course-create";

export default function NewCoursePage() {
  const router = useRouter();
  const {
    courseName,
    courseDescription,
    error,
    submitting,
    modules,
    lessonDialogModuleId,
    setCourseName,
    setCourseDescription,
    setLessonDialogModuleId,
    handleCreateCourse,
    handleAddModule,
    handleRenameModule,
    handleDeleteModule,
    handleDeleteLesson,
    openLessonDialog,
    handleAddLesson,
    handleReorderModules,
    handleReorderLessons,
  } = useCourseCreate();

  return (
    <>
      <div className="flex flex-1 flex-col bg-bg px-5 py-12 sm:px-8 md:px-12">
        <div className="mx-auto w-full max-w-[896px]">
          <button
            onClick={() => router.push("/courses")}
            className="mb-6 flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="material-symbols-rounded text-[16px]">arrow_back</span>
            Back to Courses
          </button>

          <div className="mb-12">
            <h1 className="text-[36px] font-bold leading-[40px] tracking-[-0.02em] text-fg">Create New Course</h1>
          </div>

          {error && (
            <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="rounded-xl border border-border bg-surface p-10 shadow-[0_4px_20px_0_rgba(0,0,0,0.05)]">
            <Form onSubmit={handleCreateCourse} className="space-y-8">
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <div className="rounded-lg bg-info/10 p-2">
                  <span className="material-symbols-rounded text-[20px] text-brand">menu_book</span>
                </div>
                <span className="text-xs font-bold tracking-[0.1em] text-fg">COURSE DETAILS</span>
              </div>

              <FormField>
                <FormLabel className="text-sm font-semibold text-fg">Course Title</FormLabel>
                <Input
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  placeholder="e.g. Digital Strategy 101"
                  className="rounded-lg border-border bg-surface px-4 py-3 text-base text-fg"
                  required
                />
              </FormField>

              <FormField>
                <FormLabel className="text-sm font-semibold text-fg">Description</FormLabel>
                <Textarea
                  value={courseDescription}
                  onChange={(e) => setCourseDescription(e.target.value)}
                  placeholder="What will attendees learn in this course?"
                  className="min-h-[88px] rounded-lg border-border bg-muted px-4 py-3 text-base text-fg"
                />
              </FormField>

              <div className="flex items-center justify-end gap-6 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.push("/courses")}
                  disabled={submitting}
                  className="text-sm font-semibold text-muted-fg"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  style={{
                    backgroundColor: "#29B6F6",
                    boxShadow: "0 4px 6px -4px rgba(191, 219, 254, 1), 0 10px 15px -3px rgba(191, 219, 254, 1)",
                  }}
                  className="rounded-lg px-8 py-3 text-base font-bold leading-6 text-white transition-colors hover:bg-brand/90"
                >
                  {submitting ? "Creating..." : "Create Course"}
                </Button>
              </div>
            </Form>
          </div>

          <div className="mt-8">
            <CurriculumBuilder
              modules={modules}
              onAddModule={handleAddModule}
              onRenameModule={handleRenameModule}
              onDeleteModule={handleDeleteModule}
              onDeleteLesson={handleDeleteLesson}
              onAddLessonClick={openLessonDialog}
              onReorderModules={handleReorderModules}
              onReorderLessons={handleReorderLessons}
            />
          </div>
        </div>

        <LessonDialog
          open={lessonDialogModuleId !== null}
          onOpenChange={(open) => {
            if (!open) setLessonDialogModuleId(null);
          }}
          onAddLesson={handleAddLesson}
        />
      </div>
      <Footer role="facilitator" />
    </>
  );
}
