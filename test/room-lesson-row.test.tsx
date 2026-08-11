// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { RoomLessonRow } from "@/modules/courses/components/room-lesson-row";
import type { Lesson } from "@/shared/types";

function lesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: 1,
    module_id: 10,
    description: "Prompting fundamentals",
    content_type: "pdf",
    content_url: "https://cdn.example.com/prompting.pdf",
    sequence_order: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("RoomLessonRow", () => {
  it("opens a lesson with a content url in a new tab", () => {
    render(
      <RoomLessonRow
        lesson={lesson()}
        isHighlighted={false}
        isStaff={false}
        settingHighlight={false}
        onToggleHighlight={() => {}}
      />,
    );

    const link = screen.getByRole("link", { name: /Prompting fundamentals/ }) as HTMLAnchorElement;
    expect(link.href).toBe("https://cdn.example.com/prompting.pdf");
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener");
    expect(link.rel).toContain("noreferrer");
  });

  it("renders a lesson without a content url as inert", () => {
    render(
      <RoomLessonRow
        lesson={lesson({ content_url: null })}
        isHighlighted={false}
        isStaff={false}
        settingHighlight={false}
        onToggleHighlight={() => {}}
      />,
    );

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Prompting fundamentals")).toBeTruthy();
  });

  it("marks the speaker-highlighted lesson as current", () => {
    render(
      <RoomLessonRow lesson={lesson()} isHighlighted isStaff={false} settingHighlight={false} onToggleHighlight={() => {}} />,
    );

    expect(screen.getByText("Current")).toBeTruthy();
  });

  it("does not show the current badge for an unhighlighted lesson", () => {
    render(
      <RoomLessonRow
        lesson={lesson()}
        isHighlighted={false}
        isStaff={false}
        settingHighlight={false}
        onToggleHighlight={() => {}}
      />,
    );

    expect(screen.queryByText("Current")).toBeNull();
  });

  it("shows the highlight toggle only to staff", () => {
    render(
      <RoomLessonRow
        lesson={lesson()}
        isHighlighted={false}
        isStaff={false}
        settingHighlight={false}
        onToggleHighlight={() => {}}
      />,
    );

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("lets staff toggle the highlight and reflects the highlighted state", () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <RoomLessonRow lesson={lesson()} isHighlighted={false} isStaff settingHighlight={false} onToggleHighlight={onToggle} />,
    );

    const toggle = screen.getByRole("button", { name: "Highlight" });
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(<RoomLessonRow lesson={lesson()} isHighlighted isStaff settingHighlight={false} onToggleHighlight={onToggle} />);
    expect(screen.getByRole("button", { name: "Highlighted" })).toBeTruthy();
  });

  it("disables the highlight toggle while a highlight is being set", () => {
    render(<RoomLessonRow lesson={lesson()} isHighlighted={false} isStaff settingHighlight onToggleHighlight={() => {}} />);

    expect((screen.getByRole("button", { name: "Highlight" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
