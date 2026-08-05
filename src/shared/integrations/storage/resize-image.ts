"use client";

// Covers render around 350px wide and avatars smaller still, so this leaves
// room for high-density displays while discarding the several thousand pixels a
// phone camera adds. Byte size tracks pixel area, so halving the longest edge
// quarters the file.
export const MAX_IMAGE_DIMENSION = 1600;

// Cameras ship JPEG at quality 90-100, so dropping to 80 pays even when the
// dimensions already fit.
const JPEG_QUALITY = 0.8;

const RESIZABLE = ["image/jpeg", "image/png"];

/**
 * The dimensions to draw at, or null to leave the image alone.
 *
 * Separated from the canvas work because this is the part worth testing: jsdom
 * implements neither createImageBitmap nor toBlob, so the drawing itself can
 * only be exercised in a real browser.
 */
export function scaledDimensions(width: number, height: number): { width: number; height: number } | null {
  const longestEdge = Math.max(width, height);
  if (longestEdge <= MAX_IMAGE_DIMENSION) return null;

  const scale = MAX_IMAGE_DIMENSION / longestEdge;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Shrinks an image before it is uploaded.
 *
 * This ran on the server until the resizer proved unshippable: photon compiles
 * its WebAssembly from base64 at request time, which workerd forbids, and no
 * Next bundler will hand the module to wrangler instead. Doing it here removes
 * the dependency rather than working around it, and the bytes that cross the
 * network are the small ones — the upload gets faster on exactly the phone
 * connections that produce the largest files.
 *
 * Never throws. A browser that cannot decode the file uploads it untouched,
 * because the route's own type and size limits still apply and refusing here
 * would fail an upload that would otherwise have worked.
 */
export async function resizeImage(file: File): Promise<File> {
  if (!RESIZABLE.includes(file.type)) return file;

  let bitmap: ImageBitmap;
  try {
    // Phone cameras record rotation in EXIF rather than in the pixels, and a
    // canvas draws the unrotated buffer. Without this, portrait photos upload
    // on their side.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  try {
    const target = scaledDimensions(bitmap.width, bitmap.height);
    // Re-encoding a PNG that already fits returns the same bytes for the same
    // pixels, so it is pure work. A JPEG still gains from the quality drop.
    if (!target && file.type === "image/png") return file;

    const canvas = document.createElement("canvas");
    canvas.width = target?.width ?? bitmap.width;
    canvas.height = target?.height ?? bitmap.height;

    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, file.type, file.type === "image/jpeg" ? JPEG_QUALITY : undefined),
    );
    if (!blob) return file;

    return new File([blob], file.name, { type: file.type });
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}
