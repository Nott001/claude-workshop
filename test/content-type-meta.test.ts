import { describe, it, expect } from "vitest";
import { contentTypeMeta } from "@/modules/courses/lib/content-type-meta";

describe("contentTypeMeta", () => {
  it("maps pdf to its icon and label", () => {
    expect(contentTypeMeta("pdf")).toEqual({ icon: "picture_as_pdf", label: "PDF" });
  });

  it("maps video to its icon and label", () => {
    expect(contentTypeMeta("video")).toEqual({ icon: "play_circle", label: "Video" });
  });

  it("maps image to its icon and label", () => {
    expect(contentTypeMeta("image")).toEqual({ icon: "image", label: "Image" });
  });

  it("maps link to its icon and label", () => {
    expect(contentTypeMeta("link")).toEqual({ icon: "link", label: "Link" });
  });
});
