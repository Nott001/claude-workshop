// The bare specifier is deliberate: photon's export map resolves it to the
// workerd build on Cloudflare and the node build in dev and tests.
import { PhotonImage } from "@cf-wasm/photon";

/**
 * Photon returns bytes typed as `ArrayBufferLike`, which `File` rejects because
 * it could in principle be a SharedArrayBuffer. WASM linear memory never is, so
 * this narrows the type without copying the bytes.
 */
export function toBlobPart(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength);
}

// Photon is WebAssembly. sharp bound to libvips as a native Node addon, which a
// V8 isolate cannot load, so it ruled out Cloudflare Workers as a deployment
// target for the three upload routes that call this.
export async function optimizeImage(file: File): Promise<File> {
  // PNG is returned untouched: photon re-encodes it byte-for-byte, so the work
  // buys nothing. sharp used to quantise the palette here; no WASM codec that
  // runs in both Node and a Worker replaces that today.
  if (file.type !== "image/jpeg") return file;

  const image = PhotonImage.new_from_byteslice(new Uint8Array(await file.arrayBuffer()));
  try {
    return new File([toBlobPart(image.get_bytes_jpeg(80))], file.name, { type: file.type });
  } finally {
    // Photon allocates in WASM memory that the JS heap does not track.
    image.free();
  }
}
