// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MaterialViewer } from "@/modules/courses/components/material-viewer";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const pdf = { name: "Intro deck", contentType: "pdf" as const, url: "/api/storage/course_assets/deck.pdf" };

describe("MaterialViewer", () => {
  it("stays shut with no target", () => {
    render(<MaterialViewer target={null} onClose={() => {}} />);

    expect(screen.queryByRole("button", { name: /Open in new tab/ })).toBeNull();
  });

  it("frames a pdf, which is same-origin and embeds reliably", () => {
    render(<MaterialViewer target={pdf} onClose={() => {}} />);

    const frame = document.querySelector("iframe");
    expect(frame?.getAttribute("src")).toBe(pdf.url);
    expect(frame?.getAttribute("title")).toBe("Intro deck");
  });

  it("renders an image as an image, not a frame", () => {
    render(
      <MaterialViewer
        target={{ name: "Architecture", contentType: "image", url: "/api/storage/course_assets/arch.png" }}
        onClose={() => {}}
      />,
    );

    expect(screen.getByRole("img", { name: "Architecture" }).getAttribute("src")).toBe("/api/storage/course_assets/arch.png");
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("gives a video its own controls", () => {
    render(
      <MaterialViewer
        target={{ name: "Welcome", contentType: "video", url: "/api/storage/course_videos/welcome.mp4" }}
        onClose={() => {}}
      />,
    );

    const video = document.querySelector("video");
    expect(video?.getAttribute("src")).toBe("/api/storage/course_videos/welcome.mp4");
    expect(video?.hasAttribute("controls")).toBe(true);
  });

  // Framing an external link is what was asked for, but a site sending
  // X-Frame-Options renders blank with no error of its own.
  it("warns that a link may refuse to be embedded", () => {
    render(
      <MaterialViewer target={{ name: "Handbook", contentType: "link", url: "https://example.test/h" }} onClose={() => {}} />,
    );

    expect(screen.getByText(/refuse to be embedded/)).toBeTruthy();
  });

  it("does not warn for stored material, which always embeds", () => {
    render(<MaterialViewer target={pdf} onClose={() => {}} />);

    expect(screen.queryByText(/refuse to be embedded/)).toBeNull();
  });

  it("always offers the escape hatch to a real tab", () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);

    render(<MaterialViewer target={pdf} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Open in new tab/ }));

    expect(open).toHaveBeenCalledWith(pdf.url, "_blank", "noopener,noreferrer");
  });
});
