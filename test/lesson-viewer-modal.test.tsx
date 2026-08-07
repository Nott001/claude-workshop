// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { LessonViewerModal, lessonContentTypeIcon } from "@/modules/courses/components/lesson-viewer-modal";

afterEach(() => {
  cleanup();
});

describe("lessonContentTypeIcon", () => {
  it("returns the correct icon for each content type", () => {
    expect(lessonContentTypeIcon("pdf")).toBe("picture_as_pdf");
    expect(lessonContentTypeIcon("video")).toBe("play_circle");
    expect(lessonContentTypeIcon("image")).toBe("image");
    expect(lessonContentTypeIcon("link")).toBe("link");
    expect(lessonContentTypeIcon("unknown")).toBe("description");
  });
});

describe("LessonViewerModal", () => {
  it("renders nothing when lesson is null", () => {
    const { container } = render(<LessonViewerModal lesson={null} open={true} onOpenChange={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when content_url is null", () => {
    const { container } = render(
      <LessonViewerModal
        lesson={{ id: 1, description: "Test", content_type: "pdf", content_url: null }}
        open={true}
        onOpenChange={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the dialog with the lesson title when open", () => {
    render(
      <LessonViewerModal
        lesson={{ id: 1, description: "My PDF", content_type: "pdf", content_url: "https://example.com/file.pdf" }}
        open={true}
        onOpenChange={() => {}}
      />,
    );

    expect(screen.getByText("My PDF")).toBeTruthy();
  });
});
