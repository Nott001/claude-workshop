import { describe, it, expect } from "vitest";
import { scaledDimensions, resizeImage, MAX_IMAGE_DIMENSION } from "@/shared/integrations/storage/resize-image";

describe("scaledDimensions", () => {
  it("leaves an image that already fits alone", () => {
    expect(scaledDimensions(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION - 1)).toBeNull();
    expect(scaledDimensions(800, 600)).toBeNull();
  });

  it("bounds the longest edge, whichever edge that is", () => {
    const landscape = scaledDimensions(4000, 3000);
    const portrait = scaledDimensions(3000, 4000);

    expect(landscape?.width).toBe(MAX_IMAGE_DIMENSION);
    expect(portrait?.height).toBe(MAX_IMAGE_DIMENSION);
  });

  it("keeps the aspect ratio, so nothing uploads stretched", () => {
    const target = scaledDimensions(4000, 3000)!;

    expect(target.width / target.height).toBeCloseTo(4000 / 3000, 2);
  });

  it("scales a panorama by its long edge rather than clamping both", () => {
    const target = scaledDimensions(6000, 1000)!;

    expect(target.width).toBe(MAX_IMAGE_DIMENSION);
    expect(target.height).toBeLessThan(MAX_IMAGE_DIMENSION);
    expect(target.height).toBeGreaterThan(0);
  });
});

describe("resizeImage", () => {
  // Course lessons post videos and PDFs through the same upload call, so a
  // resizer that touched them would corrupt the file it was handed.
  it("returns a non-image untouched", async () => {
    const pdf = new File([new Uint8Array([1, 2, 3])], "slides.pdf", { type: "application/pdf" });

    await expect(resizeImage(pdf)).resolves.toBe(pdf);
  });

  it("returns a video untouched", async () => {
    const video = new File([new Uint8Array([4, 5, 6])], "lecture.mp4", { type: "video/mp4" });

    await expect(resizeImage(video)).resolves.toBe(video);
  });

  // Refusing here would fail an upload the route would have accepted, so a
  // decode failure has to degrade to the original bytes. Node has no
  // createImageBitmap, which makes this the undecodable case.
  it("falls back to the original file when the image cannot be decoded", async () => {
    const notReallyAPng = new File([new Uint8Array([0, 1, 2])], "broken.png", { type: "image/png" });

    await expect(resizeImage(notReallyAPng)).resolves.toBe(notReallyAPng);
  });
});
