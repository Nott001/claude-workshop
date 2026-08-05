// KNOWN BROKEN ON WORKERS. Every upload route 500s in production with:
//
//   CompileError: WebAssembly.Module(): Wasm code generation disallowed by embedder
//
// Photon's export map carries a `workerd` condition, but the Next build never
// asks for it and resolves `node`, which inlines the WASM as base64 and calls
// `new WebAssembly.Module()` on it. Turbopack makes that chunk lazy, so the
// call happens inside a request — the one place workerd forbids it.
//
// The obvious fix, importing `@cf-wasm/photon/workerd`, does not build. That
// entry imports a real `.wasm` expecting the bundler to hand back a
// `WebAssembly.Module` as the default export, which is wrangler's convention.
// Turbopack fails to resolve it at all; webpack with `asyncWebAssembly`
// instantiates the module itself and exposes its exports, so the default is
// still missing. Both Next bundlers insist on owning the instantiation.
//
// Fixing this needs a different route to the bytes, not a different import.
// See the options recorded alongside this in CHANGELOG.md.
import { PhotonImage, SamplingFilter, resize } from "@cf-wasm/photon";

/**
 * Photon returns bytes typed as `ArrayBufferLike`, which `File` rejects because
 * it could in principle be a SharedArrayBuffer. WASM linear memory never is, so
 * this narrows the type without copying the bytes.
 */
export function toBlobPart(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength);
}

// Covers render around 350px wide and avatars smaller still, so this leaves
// room for high-density displays while discarding the several thousand pixels a
// phone camera adds. Byte size tracks pixel area, so halving the longest edge
// quarters the file — far more than the palette quantisation sharp used to do.
export const MAX_IMAGE_DIMENSION = 1600;

// Photon is WebAssembly. sharp bound to libvips as a native Node addon, which a
// V8 isolate cannot load, so it ruled out Cloudflare Workers as a deployment
// target for the three upload routes that call this.
export async function optimizeImage(file: File): Promise<File> {
  if (file.type === "image/jpeg") return reencodeJpeg(file);
  if (file.type === "image/png") return shrinkPng(file);
  return file;
}

/** The scaled image, or null when it already fits. The caller frees it. */
function scaleToFit(image: PhotonImage): PhotonImage | null {
  const width = image.get_width();
  const height = image.get_height();
  const longestEdge = Math.max(width, height);

  if (longestEdge <= MAX_IMAGE_DIMENSION) return null;

  const scale = MAX_IMAGE_DIMENSION / longestEdge;
  return resize(image, Math.round(width * scale), Math.round(height * scale), SamplingFilter.Lanczos3);
}

/** Always re-encodes: cameras ship JPEG at quality 90-100, so dropping to 80 pays even when the dimensions already fit. */
async function reencodeJpeg(file: File): Promise<File> {
  const image = PhotonImage.new_from_byteslice(new Uint8Array(await file.arrayBuffer()));
  try {
    const scaled = scaleToFit(image);
    try {
      return new File([toBlobPart((scaled ?? image).get_bytes_jpeg(80))], file.name, { type: file.type });
    } finally {
      scaled?.free();
    }
  } finally {
    // Photon allocates in WASM memory that the JS heap does not track.
    image.free();
  }
}

/** Only re-encodes when scaling: photon returns a same-size PNG byte-for-byte, so encoding one that already fits is pure waste. */
async function shrinkPng(file: File): Promise<File> {
  const image = PhotonImage.new_from_byteslice(new Uint8Array(await file.arrayBuffer()));
  try {
    const scaled = scaleToFit(image);
    if (!scaled) return file;
    try {
      return new File([toBlobPart(scaled.get_bytes())], file.name, { type: file.type });
    } finally {
      scaled.free();
    }
  } finally {
    image.free();
  }
}
