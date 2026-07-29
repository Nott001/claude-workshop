import sharp from "sharp";

export async function optimizeImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const buffer = Buffer.from(await file.arrayBuffer());
  const pipeline = sharp(buffer);
  let optimized: Buffer;

  if (file.type === "image/png") {
    optimized = await pipeline.png({ quality: 85, palette: true }).toBuffer();
  } else {
    optimized = await pipeline.jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  }

  // sharp returns a Node Buffer, typed as Uint8Array<ArrayBufferLike>, but File
  // needs an ArrayBuffer-backed view. Node buffers are never backed by a
  // SharedArrayBuffer, so this narrows the type without copying the bytes.
  const bytes = new Uint8Array(optimized.buffer as ArrayBuffer, optimized.byteOffset, optimized.byteLength);

  return new File([bytes], file.name, { type: file.type });
}
