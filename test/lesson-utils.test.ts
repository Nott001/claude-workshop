import { describe, it, expect } from "vitest";
import { detectContentType, normalizeUrl, getUploadEndpoint } from "@/modules/courses/lib/lesson-utils";

function fileOfType(type: string): File {
  return new File(["x"], "asset", { type });
}

describe("detectContentType", () => {
  it("classifies any video/* mime as video", () => {
    expect(detectContentType(fileOfType("video/mp4"), "")).toBe("video");
    expect(detectContentType(fileOfType("video/webm"), "")).toBe("video");
    expect(detectContentType(fileOfType("video/quicktime"), "")).toBe("video");
  });

  it("classifies pdf by exact mime", () => {
    expect(detectContentType(fileOfType("application/pdf"), "")).toBe("pdf");
  });

  it("falls back to image for any other uploaded file", () => {
    expect(detectContentType(fileOfType("image/png"), "")).toBe("image");
    // Deliberate: a .docx upload is currently stored as an image, not rejected.
    expect(detectContentType(fileOfType("application/vnd.openxmlformats"), "")).toBe("image");
  });

  it("classifies as link when no file is supplied", () => {
    expect(detectContentType(null, "https://example.com/video.mp4")).toBe("link");
  });

  it("prefers the file over the url when both are present", () => {
    expect(detectContentType(fileOfType("application/pdf"), "https://example.com")).toBe("pdf");
  });
});

describe("normalizeUrl", () => {
  it("leaves absolute http and https urls untouched", () => {
    expect(normalizeUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(normalizeUrl("http://example.com/a")).toBe("http://example.com/a");
  });

  it("prefixes https when no scheme is present", () => {
    expect(normalizeUrl("example.com/a")).toBe("https://example.com/a");
    expect(normalizeUrl("www.example.com")).toBe("https://www.example.com");
  });

  it("prefixes schemes it does not recognise rather than passing them through", () => {
    // Guards against a javascript: or data: url reaching an href unmodified.
    expect(normalizeUrl("javascript:alert(1)")).toBe("https://javascript:alert(1)");
    expect(normalizeUrl("data:text/html,<script>")).toBe("https://data:text/html,<script>");
  });
});

describe("getUploadEndpoint", () => {
  it("routes video and pdf to their upload endpoints", () => {
    expect(getUploadEndpoint("video")).toBe("/api/upload/course-video");
    expect(getUploadEndpoint("pdf")).toBe("/api/upload/course-asset");
  });

  it("returns undefined for types that are not uploaded", () => {
    expect(getUploadEndpoint("link")).toBeUndefined();
    expect(getUploadEndpoint("image")).toBeUndefined();
    expect(getUploadEndpoint("")).toBeUndefined();
  });
});
