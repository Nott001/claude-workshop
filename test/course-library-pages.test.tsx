// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

const { useCourseLibrary, useCourseContent } = vi.hoisted(() => ({
  useCourseLibrary: vi.fn(),
  useCourseContent: vi.fn(),
}));

vi.mock("@/modules/courses/lib/use-course-library", () => ({ useCourseLibrary }));
vi.mock("@/modules/courses/lib/use-course-content", () => ({ useCourseContent }));
vi.mock("next/navigation", () => ({ useParams: () => ({ courseId: "4" }) }));

import { CourseLibraryPage } from "@/modules/courses/pages/course-library";
import { SelfPacedCoursePage } from "@/modules/courses/pages/self-paced-course";

const COURSE = {
  id: 4,
  course_name: "Rust in Anger",
  course_description: "Ownership and borrowing.",
  EVENT: { id: 30, title: "Rust Day", event_date: "2026-08-18" },
  MODULE: [{ id: 1, LESSON: [{ id: 11 }, { id: 12 }] }],
};

const CONTENT = {
  id: 4,
  course_name: "Rust in Anger",
  course_description: "Ownership and borrowing.",
  MODULE: [
    {
      id: 1,
      module_name: "Ownership",
      module_type: "lessons",
      LESSONS: [{ id: 11, name: "Moves", content_type: "pdf", content_url: "https://x.test/a.pdf" }],
    },
    { id: 2, module_name: "Ask anything", module_type: "qa", LESSONS: [] },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  useCourseLibrary.mockReturnValue({ courses: [COURSE], loading: false, error: null });
  useCourseContent.mockReturnValue({ access: "allowed", course: CONTENT, grant: "live", releasedModuleIds: [1] });
});

afterEach(cleanup);

describe("CourseLibraryPage", () => {
  it("lists a released course with its counts and where it came from", () => {
    render(<CourseLibraryPage />);

    expect(screen.getByText("Rust in Anger")).toBeTruthy();
    expect(screen.getByText(/1 module · 2 lessons/)).toBeTruthy();
    expect(screen.getByText(/from Rust Day/)).toBeTruthy();
  });

  it("links the card at the self-paced surface, not the live room", () => {
    render(<CourseLibraryPage />);

    expect(screen.getByRole("link", { name: /Rust in Anger/ }).getAttribute("href")).toBe("/courses/4");
  });

  it("surfaces a listing that would not load", () => {
    useCourseLibrary.mockReturnValue({ courses: [], loading: false, error: "Could not load your courses." });

    render(<CourseLibraryPage />);

    expect(screen.getByText("Could not load your courses.")).toBeTruthy();
  });

  it("waits rather than calling an unloaded library empty", () => {
    useCourseLibrary.mockReturnValue({ courses: [], loading: true, error: null });

    render(<CourseLibraryPage />);

    expect(screen.getByText("Loading your courses...")).toBeTruthy();
    expect(screen.queryByText("Nothing unlocked yet")).toBeNull();
  });

  it("counts one module and one lesson in the singular", () => {
    useCourseLibrary.mockReturnValue({
      courses: [{ ...COURSE, MODULE: [{ id: 1, LESSON: [{ id: 11 }] }] }],
      loading: false,
      error: null,
    });

    render(<CourseLibraryPage />);

    expect(screen.getByText(/1 module · 1 lesson(?!s)/)).toBeTruthy();
  });

  it("renders a course with no description or event of its own", () => {
    // EVENT is nullable on the summary, and a course need not describe itself;
    // neither should leave a dangling separator on the card.
    useCourseLibrary.mockReturnValue({
      courses: [{ ...COURSE, course_description: null, EVENT: null }],
      loading: false,
      error: null,
    });

    render(<CourseLibraryPage />);

    expect(screen.getByText("Rust in Anger")).toBeTruthy();
    expect(screen.queryByText(/from /)).toBeNull();
  });

  it("explains an empty library rather than showing a bare page", () => {
    useCourseLibrary.mockReturnValue({ courses: [], loading: false, error: null });

    render(<CourseLibraryPage />);

    expect(screen.getByText("Nothing unlocked yet")).toBeTruthy();
  });
});

describe("SelfPacedCoursePage", () => {
  it("renders the curriculum with its material linked", () => {
    render(<SelfPacedCoursePage />);

    expect(screen.getByText("Ownership")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Moves/ }).getAttribute("href")).toBe("https://x.test/a.pdf");
  });

  it("leaves the Q&A module out entirely", () => {
    // Its read policy wants a live session behind it, and there is none here
    // — the panel would sit there and never deliver.
    render(<SelfPacedCoursePage />);

    expect(screen.queryByText("Ask anything")).toBeNull();
  });

  it("marks the modules that were held back for afterwards", () => {
    render(<SelfPacedCoursePage />);

    expect(screen.getByText("After the event")).toBeTruthy();
  });

  it("leaves a module that ran in the session unmarked", () => {
    useCourseContent.mockReturnValue({ access: "allowed", course: CONTENT, grant: "live", releasedModuleIds: [] });

    render(<SelfPacedCoursePage />);

    expect(screen.getByText("Ownership")).toBeTruthy();
    expect(screen.queryByText("After the event")).toBeNull();
  });

  it("waits rather than showing the lock while the fetch is in flight", () => {
    // The locked view and the loading view differ by one word to a reader, so
    // showing the wrong one tells someone they were refused when they were not.
    useCourseContent.mockReturnValue({ access: "loading", course: null, grant: null, releasedModuleIds: [] });

    render(<SelfPacedCoursePage />);

    expect(screen.getByText("Loading course...")).toBeTruthy();
    expect(screen.queryByText("This course is not open to you.")).toBeNull();
  });

  it("says a module is empty rather than rendering a bare heading", () => {
    useCourseContent.mockReturnValue({
      access: "allowed",
      course: {
        ...CONTENT,
        course_description: null,
        MODULE: [{ id: 3, module_name: "Reading", module_type: "lessons", LESSONS: [] }],
      },
      grant: "live",
      releasedModuleIds: [],
    });

    render(<SelfPacedCoursePage />);

    expect(screen.getByText("No material in this module.")).toBeTruthy();
  });

  it("shows a lock rather than a curriculum when the gate refused", () => {
    useCourseContent.mockReturnValue({ access: "locked", course: null, grant: null, releasedModuleIds: [] });

    render(<SelfPacedCoursePage />);

    expect(screen.getByText("This course is not open to you.")).toBeTruthy();
    expect(screen.queryByText("Ownership")).toBeNull();
  });

  it("says an event may release nothing, in both states of the page", () => {
    // "Material appears here once an event has finished and released it" reads
    // as a promise on its own, and the reader who is owed nothing cannot tell a
    // broken page from one that is still waiting.
    useCourseLibrary.mockReturnValue({ courses: [], loading: false, error: null });

    render(<CourseLibraryPage />);

    expect(screen.getByText(/Not every event has material to release after it ends/)).toBeTruthy();
    // The header carries it too, for the reader who has courses and is looking
    // for one that never arrived — they never see the empty state.
    expect(screen.getByText(/not every event does/)).toBeTruthy();
  });
});
