/**
 * Removes the metadata an image carries alongside its pixels.
 *
 * A phone writes the coordinates the photo was taken at, the device's serial,
 * and the exact time into EXIF. Uploading a profile photo therefore publishes
 * the uploader's home address to anyone who downloads the file, which is why
 * this runs before anything reaches a bucket.
 *
 * The container is rewritten rather than decoded: workerd cannot run sharp or
 * compile photon's WebAssembly, and re-encoding would cost quality for a job
 * that is really only dropping segments. Parsing bytes needs neither.
 */

/**
 * Only what the buckets accept, and only formats whose containers are handled
 * below. A type added to `policy.ts` without a case here passes through with
 * its metadata intact, so the two lists have to move together.
 */
export const STRIPPABLE_TYPES = ["image/jpeg", "image/png"];

export class UnreadableImageError extends Error {
  constructor(format: string) {
    super(`The file is not a readable ${format}, so its metadata cannot be removed.`);
    this.name = "UnreadableImageError";
  }
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * JPEG application segments worth keeping: JFIF holds pixel density and ICC
 * holds the colour profile, so dropping them changes how the image renders.
 * Everything else in the APP range is metadata — EXIF and XMP at APP1, the
 * Photoshop block carrying IPTC author and location at APP13 — as is COM.
 */
const JPEG_KEEP = new Set([0xe0, 0xe2]);
const isJpegMetadata = (marker: number) => (marker >= 0xe0 && marker <= 0xef && !JPEG_KEEP.has(marker)) || marker === 0xfe;

/** PNG chunks that carry text, timestamps or EXIF rather than pixels. */
const PNG_DROP = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);

export function stripJpeg(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new UnreadableImageError("JPEG");
  }

  const kept: Array<[number, number]> = [[0, 2]];
  let i = 2;

  while (i < bytes.length) {
    if (bytes[i] !== 0xff) throw new UnreadableImageError("JPEG");

    // A marker may be preceded by any number of 0xFF fill bytes.
    let marker = i;
    while (marker < bytes.length && bytes[marker] === 0xff) marker++;
    if (marker >= bytes.length) throw new UnreadableImageError("JPEG");

    const code = bytes[marker];

    // Past the start of scan the file is entropy-coded pixel data, which has no
    // segment structure to walk and nothing to strip.
    if (code === 0xda || code === 0xd9) {
      kept.push([i, bytes.length]);
      break;
    }

    // Restart and temporary markers carry no payload.
    if ((code >= 0xd0 && code <= 0xd7) || code === 0x01) {
      kept.push([i, marker + 1]);
      i = marker + 1;
      continue;
    }

    if (marker + 2 >= bytes.length) throw new UnreadableImageError("JPEG");
    const length = (bytes[marker + 1] << 8) | bytes[marker + 2];
    const end = marker + 1 + length;
    if (length < 2 || end > bytes.length) throw new UnreadableImageError("JPEG");

    if (!isJpegMetadata(code)) kept.push([i, end]);
    i = end;
  }

  return concat(bytes, kept);
}

export function stripPng(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 8 || PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)) {
    throw new UnreadableImageError("PNG");
  }

  const kept: Array<[number, number]> = [[0, 8]];
  let i = 8;

  while (i + 8 <= bytes.length) {
    const length = (bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3];
    // Chunk types are four ASCII letters. Read as character codes rather than
    // through TextDecoder, whose non-UTF-8 encodings workerd does not promise.
    const type = String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7]);
    // Length, type, payload and the trailing CRC. Whole chunks are dropped, so
    // no checksum needs recomputing.
    const end = i + 12 + length;
    if (end > bytes.length) throw new UnreadableImageError("PNG");

    if (!PNG_DROP.has(type)) kept.push([i, end]);
    i = end;

    // Anything appended past the end marker is not part of the image, and is a
    // place metadata hides from readers that stop here.
    if (type === "IEND") break;
  }

  return concat(bytes, kept);
}

/**
 * The file with its metadata removed, or the file itself when there is nothing
 * here that can read it.
 *
 * Never throws. A file whose bytes are not the image its type claims is stored
 * as it arrived, because refusing it would fail uploads that used to work and
 * the upload routes, not this, are where a file is judged acceptable. The cost
 * is that such a file keeps whatever it carries — a deliberate trade, since a
 * container this cannot parse is one it cannot safely rewrite either.
 */
export async function stripImageMetadata(file: File): Promise<File> {
  if (!STRIPPABLE_TYPES.includes(file.type)) return file;

  const bytes = new Uint8Array(await file.arrayBuffer());

  let cleaned: Uint8Array;
  try {
    cleaned = file.type === "image/jpeg" ? stripJpeg(bytes) : stripPng(bytes);
  } catch {
    return file;
  }

  if (cleaned.length === bytes.length) return file;
  return new File([cleaned as BlobPart], file.name, { type: file.type });
}

function concat(source: Uint8Array, ranges: Array<[number, number]>): Uint8Array {
  const size = ranges.reduce((total, [start, end]) => total + (end - start), 0);
  const out = new Uint8Array(size);

  let offset = 0;
  for (const [start, end] of ranges) {
    out.set(source.subarray(start, end), offset);
    offset += end - start;
  }

  return out;
}
