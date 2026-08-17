// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));

import { ManageCoursePage } from "@/modules/courses/components/manage-course-page";
import type { CourseBuilder } from "@/modules/courses/components/course-builder-section";
import type { ModuleWithLessons } from "@/modules/courses/lib/types";

function mod(name: string): ModuleWithLessons {
  return {
    id: 1,
    course_id: 1,
    module_name: name,
    sequence_order: 1,
    module_type: "lessons",
    is_locked: false,
    start_time: null,
    end_time: null,
    speaker_profile_id: null,
    created_at: "",
    updated_at: "",
    LESSONS: [],
  };
}

/** Only the fields this screen actually reaches for. */
function builder(modules: ModuleWithLessons[]): CourseBuilder {
  return {
    modules,
    error: null,
    handleAddModule: vi.fn(),
    handleAddQaModule: vi.fn(),
    handleDeleteModule: vi.fn(),
    handleReorderModules: vi.fn(),
    handleMoveLesson: vi.fn(),
    handleSaveModule: vi.fn(),
  } as unknown as CourseBuilder;
}

afterEach(cleanup);

describe("ManageCoursePage", () => {
  it("shows the loading gate instead of the screen while loading", () => {
    render(<ManageCoursePage loading backHref="/staff/events/4" builder={builder([])} speakers={[]} />);

    expect(screen.getByText("Loading...")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Manage Course" })).toBeNull();
  });

  it("points Back at the route that rendered it", () => {
    render(<ManageCoursePage backHref="/speaker/events/4" builder={builder([mod("Week one")])} speakers={[]} />);

    expect(screen.getByRole("link", { name: /Back to event/ }).getAttribute("href")).toBe("/speaker/events/4");
  });

  it("renders the same heading whichever route rendered it", () => {
    render(<ManageCoursePage backHref="/staff/events/4" builder={builder([mod("Week one")])} speakers={[]} />);

    expect(screen.getByRole("heading", { name: "Manage Course" })).toBeTruthy();
  });

  it("shows the curriculum when the course has modules", () => {
    render(<ManageCoursePage backHref="/staff/events/4" builder={builder([mod("Week one")])} speakers={[]} />);

    expect(screen.getByText("Week one")).toBeTruthy();
    expect(screen.getByText("CURRICULUM")).toBeTruthy();
  });

  it("offers Create Course when the event has none", () => {
    render(<ManageCoursePage backHref="/staff/events/4" builder={builder([])} speakers={[]} />);

    expect(screen.getByRole("button", { name: "Create Course" })).toBeTruthy();
  });

  // The staff route used to wrap the builder in a card of its own, so the page
  // drew one surface inside an identical one.
  it("draws exactly one card around the builder", () => {
    const { container } = render(
      <ManageCoursePage backHref="/staff/events/4" builder={builder([mod("Week one")])} speakers={[]} />,
    );

    expect(container.querySelectorAll("div.rounded-xl.border.border-border.bg-surface")).toHaveLength(1);
  });
});
