"use client";

import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormLabel } from "@/components/ui/form";
import { LessonDialog } from "@/modules/course-content/ui/lesson-dialog";
import { CurriculumBuilder } from "@/modules/course-content/ui/curriculum-builder";
import { useCourseDetail } from "@/modules/course-content/lib/use-course-detail";

export default function CourseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;
  const {
    course,
    loading,
    error,
    editDialogOpen,
    editName,
    editDescription,
    lessonDialogModuleId,
    setEditDialogOpen,
    setEditName,
    setEditDescription,
    openEditDialog,
    handleEditCourse,
    handleAddModule,
    handleRenameModule,
    handleDeleteModule,
    handleDeleteLesson,
    openLessonDialog,
    handleAddLesson,
    handleReorderModules,
    handleReorderLessons,
  } = useCourseDetail(courseId);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-bg p-8">
        <div className="text-sm text-muted-foreground">Loading course...</div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-bg p-8">
        <p className="text-destructive">{error ?? "Course not found"}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/courses")}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-bg px-5 py-12 sm:px-8 md:px-12">
      <div className="mx-auto w-full max-w-[896px]">
        <button
          onClick={() => router.push("/courses")}
          className="mb-6 flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="material-symbols-rounded text-[16px]">arrow_back</span>
          Back to Courses
        </button>

        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-info/10 p-2">
                <span className="material-symbols-rounded text-[24px] text-brand">menu_book</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-[28px] font-bold leading-[36px] tracking-[-0.02em] text-fg">{course.course_name}</h1>
                  <button
                    onClick={openEditDialog}
                    className="rounded-md p-1 text-muted-fg transition-colors hover:bg-muted hover:text-fg"
                    title="Edit course"
                  >
                    <span className="material-symbols-rounded text-[18px]">edit</span>
                  </button>
                </div>
                {course.course_description && <p className="mt-1 text-sm text-muted-fg">{course.course_description}</p>}
              </div>
            </div>
          </div>
        </div>

        {course.EVENTS && course.EVENTS.length > 0 && (
          <div className="mb-8 rounded-xl border border-border bg-surface p-6 shadow-[0_4px_20px_0_rgba(0,0,0,0.05)]">
            <div className="mb-4 flex items-center gap-3 border-b border-border pb-4">
              <div className="rounded-lg bg-info/10 p-2">
                <span className="material-symbols-rounded text-[20px] text-brand">event</span>
              </div>
              <span className="text-xs font-bold tracking-[0.1em] text-fg">LINKED EVENTS</span>
            </div>
            <div className="space-y-2">
              {course.EVENTS.map((evt) => (
                <button
                  key={evt.event_id}
                  onClick={() => router.push(`/events/${evt.event_id}`)}
                  className="flex w-full items-center justify-between rounded-lg border border-border bg-muted px-5 py-3 text-left transition-colors hover:bg-muted"
                >
                  <div>
                    <span className="text-sm font-semibold text-fg">{evt.title}</span>
                    <span className="ml-3 text-xs text-muted-fg">
                      {new Date(evt.event_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span className="ml-2 inline-flex items-center rounded-full bg-info/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-info">
                      {evt.status}
                    </span>
                  </div>
                  <span className="material-symbols-rounded text-[16px] text-muted-fg">arrow_forward</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <CurriculumBuilder
          modules={course.MODULES}
          onAddModule={handleAddModule}
          onRenameModule={handleRenameModule}
          onDeleteModule={handleDeleteModule}
          onDeleteLesson={handleDeleteLesson}
          onAddLessonClick={openLessonDialog}
          onReorderModules={handleReorderModules}
          onReorderLessons={handleReorderLessons}
        />

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Course</DialogTitle>
            </DialogHeader>
            <Form onSubmit={handleEditCourse}>
              <FormField>
                <FormLabel>Name</FormLabel>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
              </FormField>
              <FormField>
                <FormLabel>Description</FormLabel>
                <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
              </FormField>
              <Button type="submit" className="mt-4">
                Save
              </Button>
            </Form>
          </DialogContent>
        </Dialog>

        <LessonDialog
          open={lessonDialogModuleId !== null}
          onOpenChange={(open) => {
            if (!open) setLessonDialogModuleId(null);
          }}
          onAddLesson={handleAddLesson}
        />
      </div>
    </div>
  );
}
