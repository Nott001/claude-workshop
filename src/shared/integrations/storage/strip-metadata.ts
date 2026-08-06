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
import extractChunks from "png-chunks-extract";
import encodeChunks from "png-chunks-encode";

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

const PNG_SIGNATURE_LENGTH = 8;
/** Every chunk carries a four-byte length, type and checksum around its data. */
const CHUNK_OVERHEAD = 12;

export function stripJpeg(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new UnreadableImageError("JPEG");
  }

  const kept: Array<[number, number]> = [[0, 2]];
  let dropped = false;
  let orientation: number | null = null;
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

    if (isJpegMetadata(code)) {
      dropped = true;
      // A camera does not rotate a portrait photo, it records which way up the
      // sensor was and leaves the pixels sideways. Deleting that tag with the
      // rest of EXIF is what turns an upright photo on its side, so the value
      // is carried across even though nothing else in the block is.
      orientation ??= readExifOrientation(bytes.subarray(marker + 3, end));
    } else {
      kept.push([i, end]);
    }
    i = end;
  }

  // The ranges cover the whole file when nothing was dropped, so copying them
  // into a new buffer would spend a pass over the pixel data to produce the
  // bytes already in hand.
  if (!dropped) return bytes;

  // Rebuilt rather than kept: the original block is the one carrying the
  // coordinates, and a whole EXIF structure cannot be edited in place without
  // becoming the kind of parser this file exists to avoid.
  const insert = orientation !== null && orientation !== ORIENTATION_UPRIGHT ? exifOrientationSegment(orientation) : null;

  return concat(bytes, kept, insert);
}

/**
 * PNG chunks are walked by `png-chunks-extract` rather than by hand.
 *
 * The format is a length-prefixed chunk list, and reading those lengths safely
 * is where a hand-written walk goes wrong: an earlier version of this file read
 * them with a signed shift, so a chunk declaring 0x80000000 sent the cursor
 * backwards and spun until the isolate died. The library reads them through a
 * Uint32Array, checks every CRC, and has far more adversarial input behind it
 * than this project can give it.
 */
export function stripPng(bytes: Uint8Array): Uint8Array {
  if (!chunkLengthsFit(bytes)) throw new UnreadableImageError("PNG");

  let chunks: ReturnType<typeof extractChunks>;

  try {
    chunks = extractChunks(bytes);
  } catch {
    // Includes a failed CRC, which means the file is damaged rather than
    // merely unfamiliar. Callers store those as they arrived.
    throw new UnreadableImageError("PNG");
  }

  const kept = chunks.filter((chunk) => !PNG_DROP.has(chunk.name));

  // Rebuilding is also what discards anything appended past the end marker,
  // which `extractChunks` stops at — so the file is only handed back untouched
  // when the chunks it holds already account for every byte in it. Comparing
  // the lengths costs one pass over the chunk list; `encodeChunks` copies the
  // pixel payload three times to recompute checksums it would not change.
  const rebuiltLength = PNG_SIGNATURE_LENGTH + kept.reduce((total, chunk) => total + CHUNK_OVERHEAD + chunk.data.length, 0);
  if (kept.length === chunks.length && rebuiltLength === bytes.length) return bytes;

  return encodeChunks(kept);
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
    // Said out loud because the failure is otherwise invisible and the thing it
    // fails to do is privacy: if some camera's output starts tripping a parser,
    // every photo from it keeps its coordinates and nothing else would say so.
    console.error(`Metadata could not be removed from a ${file.type}; it was stored as it arrived.`);
    return file;
  }

  if (cleaned.length === bytes.length) return file;
  return new File([cleaned as BlobPart], file.name, { type: file.type });
}

/**
 * Whether every chunk header describes bytes the file actually contains.
 *
 * `extractChunks` allocates a buffer of the size a chunk declares before
 * checking it against the file, so a twenty-byte upload announcing a chunk of
 * 0x7FFFFFFF costs a 2GB allocation and 28 seconds of CPU before it is
 * rejected — from an endpoint any signed-in user can reach. Reading the
 * lengths first costs nothing and bounds what the library is handed.
 *
 * Deliberately not a parser: it allocates nothing, decides nothing about the
 * image, and hands every other judgement to the library.
 */
function chunkLengthsFit(bytes: Uint8Array): boolean {
  let i = 8;

  while (i + 12 <= bytes.length) {
    const length = ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0;
    if (i + 12 + length > bytes.length) return false;

    const isEnd = String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7]) === "IEND";
    i += 12 + length;
    // Whatever follows the end marker is not chunks, and reading it as though
    // it were would reject files the library accepts.
    if (isEnd) return true;
  }

  return true;
}

/** The EXIF tag numbering which way up the camera was held. */
const ORIENTATION_TAG = 0x0112;
const ORIENTATION_UPRIGHT = 1;
const ORIENTATION_MAX = 8;
const IFD_ENTRY_SIZE = 12;

/**
 * The orientation an EXIF block records, or null if it records none.
 *
 * Reads only: every offset is checked against the block it was found in, and
 * nothing is allocated from a value the file supplies. EXIF is a TIFF document
 * in a JPEG segment — a byte-order mark, a directory offset, then fixed-width
 * entries — so finding one tag needs no general TIFF reader.
 */
function readExifOrientation(payload: Uint8Array): number | null {
  const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
  if (payload.length < 14 || EXIF_HEADER.some((byte, index) => payload[index] !== byte)) return null;

  const tiff = payload.subarray(6);
  const littleEndian = tiff[0] === 0x49 && tiff[1] === 0x49;
  const bigEndian = tiff[0] === 0x4d && tiff[1] === 0x4d;
  if (!littleEndian && !bigEndian) return null;

  const u16 = (at: number) => (littleEndian ? tiff[at] | (tiff[at + 1] << 8) : (tiff[at] << 8) | tiff[at + 1]);
  const u32 = (at: number) =>
    (littleEndian
      ? tiff[at] | (tiff[at + 1] << 8) | (tiff[at + 2] << 16) | (tiff[at + 3] << 24)
      : (tiff[at] << 24) | (tiff[at + 1] << 16) | (tiff[at + 2] << 8) | tiff[at + 3]) >>> 0;

  const directory = u32(4);
  if (directory + 2 > tiff.length) return null;

  const entries = u16(directory);
  for (let entry = 0; entry < entries; entry++) {
    const at = directory + 2 + entry * IFD_ENTRY_SIZE;
    if (at + IFD_ENTRY_SIZE > tiff.length) return null;
    if (u16(at) !== ORIENTATION_TAG) continue;

    // A SHORT sits in the first half of the four-byte value field.
    const value = u16(at + 8);
    return value >= ORIENTATION_UPRIGHT && value <= ORIENTATION_MAX ? value : null;
  }

  return null;
}

/**
 * An EXIF segment holding the orientation and nothing else.
 *
 * Fixed bytes with one variable: a big-endian TIFF header, a directory of a
 * single SHORT entry, and no next directory. Constructing it is what keeps the
 * original block — coordinates and all — out of the file.
 */
function exifOrientationSegment(orientation: number): Uint8Array {
  return Uint8Array.from([
    0xff,
    0xe1,
    0x00,
    0x22, // APP1, covering the 32 bytes that follow plus itself
    0x45,
    0x78,
    0x69,
    0x66,
    0x00,
    0x00, // "Exif\0\0"
    0x4d,
    0x4d,
    0x00,
    0x2a,
    0x00,
    0x00,
    0x00,
    0x08, // big-endian TIFF, directory at byte 8
    0x00,
    0x01, // one entry
    (ORIENTATION_TAG >> 8) & 0xff,
    ORIENTATION_TAG & 0xff,
    0x00,
    0x03, // SHORT
    0x00,
    0x00,
    0x00,
    0x01, // one of them
    0x00,
    orientation,
    0x00,
    0x00, // the value, left-aligned in its four bytes
    0x00,
    0x00,
    0x00,
    0x00, // no directory follows
  ]);
}

/**
 * The kept ranges of `source` in order, with `insert` placed after the first.
 *
 * The first range is the start-of-image marker, and an application segment has
 * to follow it rather than precede it.
 */
function concat(source: Uint8Array, ranges: Array<[number, number]>, insert: Uint8Array | null = null): Uint8Array {
  const kept = ranges.reduce((total, [start, end]) => total + (end - start), 0);
  const out = new Uint8Array(kept + (insert?.length ?? 0));

  let offset = 0;
  ranges.forEach(([start, end], index) => {
    out.set(source.subarray(start, end), offset);
    offset += end - start;

    if (index === 0 && insert) {
      out.set(insert, offset);
      offset += insert.length;
    }
  });

  return out;
}
