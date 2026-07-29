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

  return new File([optimized], file.name, { type: file.type });
}
