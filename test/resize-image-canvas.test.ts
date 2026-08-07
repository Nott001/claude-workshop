// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { resizeImage, MAX_IMAGE_DIMENSION } from "@/shared/integrations/storage/resize-image";

/**
 * jsdom ships no canvas backend and no createImageBitmap, so the platform is
 * stubbed and the assertions are about what this module asks it to do: the
 * dimensions it draws at, and the encoder settings it passes.
 */
function stubBrowser(width: number, height: number) {
  const drawn: Array<{ width: number; height: number }> = [];
  const encoded: Array<{ type: string; quality: number | undefined }> = [];
  let closed = false;

  vi.stubGlobal("createImageBitmap", async () => ({ width, height, close: () => (closed = true) }));

  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage: () => drawn.push({ width: canvas.width, height: canvas.height }),
    }),
    toBlob: (done: (blob: Blob | null) => void, type: string, quality?: number) => {
      encoded.push({ type, quality });
      done(new Blob([new Uint8Array(16)], { type }));
    },
  };

  const createElement = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tag: string) =>
    tag === "canvas" ? (canvas as unknown as HTMLElement) : createElement(tag),
  );

  return { drawn, encoded, wasClosed: () => closed };
}

const jpeg = () => new File([new Uint8Array([1, 2, 3])], "photo.jpg", { type: "image/jpeg" });
const png = () => new File([new Uint8Array([1, 2, 3])], "shot.png", { type: "image/png" });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("resizeImage drawing", () => {
  it("draws an oversized photo at the bounded size", async () => {
    const { drawn } = stubBrowser(4000, 3000);

    const result = await resizeImage(jpeg());

    expect(drawn).toEqual([{ width: MAX_IMAGE_DIMENSION, height: 1200 }]);
    expect(result.type).toBe("image/jpeg");
    expect(result.name).toBe("photo.jpg");
  });

  it("re-encodes a JPEG that already fits, because the quality drop still pays", async () => {
    const { drawn, encoded } = stubBrowser(800, 600);

    await resizeImage(jpeg());

    expect(drawn).toEqual([{ width: 800, height: 600 }]);
    expect(encoded[0].quality).toBe(0.8);
  });

  it("leaves a PNG that already fits completely alone", async () => {
    const { drawn, encoded } = stubBrowser(800, 600);
    const original = png();

    // Re-encoding it would return the same pixels for the same bytes.
    await expect(resizeImage(original)).resolves.toBe(original);
    expect(drawn).toEqual([]);
    expect(encoded).toEqual([]);
  });

  it("encodes a PNG without a quality setting, which the format has no use for", async () => {
    const { encoded } = stubBrowser(4000, 3000);

    await resizeImage(png());

    expect(encoded).toEqual([{ type: "image/png", quality: undefined }]);
  });

  it("releases the decoded bitmap, which is not on the JS heap", async () => {
    const { wasClosed } = stubBrowser(4000, 3000);

    await resizeImage(jpeg());

    expect(wasClosed()).toBe(true);
  });

  it("falls back to the original file when the encoder yields nothing", async () => {
    stubBrowser(4000, 3000);
    const canvas = document.createElement("canvas") as unknown as {
      toBlob: (done: (b: Blob | null) => void) => void;
    };
    canvas.toBlob = (done) => done(null);
    const original = jpeg();

    await expect(resizeImage(original)).resolves.toBe(original);
  });
});
