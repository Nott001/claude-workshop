import { describe, it, expect } from "vitest";
import {
  stripJpeg,
  stripPng,
  stripImageMetadata,
  UnreadableImageError,
  STRIPPABLE_TYPES,
} from "@/shared/integrations/storage/strip-metadata";
import { ascii, chunk, PNG_SIGNATURE } from "./helpers/png-fixture";
import { STORAGE_BUCKETS, validateFileType } from "@/shared/integrations/storage/policy";

const bytes = (...values: number[]) => Uint8Array.from(values);
const contains = (haystack: Uint8Array, needle: string) => new TextDecoder("latin1").decode(haystack).includes(needle);

/** A marker segment: 0xFF, its code, then a big-endian length covering itself. */
function segment(marker: number, payload: number[]): number[] {
  const length = payload.length + 2;
  return [0xff, marker, (length >> 8) & 0xff, length & 0xff, ...payload];
}

const SCAN = [0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x12, 0x34, 0x56, 0xff, 0xd9];

/** EXIF as a camera writes it: the marker, the namespace, then the payload. */
const EXIF_PAYLOAD = [...ascii("Exif\0\0"), ...ascii("GPSLatitude 14.5995 GPSLongitude 120.9842")];

function jpeg(extra: number[] = []) {
  return bytes(0xff, 0xd8, ...segment(0xe0, ascii("JFIF\0")), ...extra, ...SCAN);
}

describe("stripJpeg", () => {
  it("removes the EXIF block a camera writes the location into", async () => {
    const withExif = jpeg(segment(0xe1, EXIF_PAYLOAD));

    expect(contains(withExif, "GPSLatitude")).toBe(true);
    expect(contains(stripJpeg(withExif), "GPSLatitude")).toBe(false);
  });

  it("removes XMP, the Photoshop block and free-text comments", async () => {
    const noisy = jpeg([
      ...segment(0xe1, ascii("http://ns.adobe.com/xap/1.0/\0<x>author</x>")),
      ...segment(0xed, ascii("Photoshop 3.0\0IPTC city Manila")),
      ...segment(0xfe, ascii("shot on my phone")),
    ]);

    const cleaned = stripJpeg(noisy);

    expect(contains(cleaned, "adobe")).toBe(false);
    expect(contains(cleaned, "IPTC")).toBe(false);
    expect(contains(cleaned, "shot on my phone")).toBe(false);
  });

  it("keeps the colour profile and density, which change how the image renders", async () => {
    const withIcc = jpeg([...segment(0xe2, ascii("ICC_PROFILE\0sRGB")), ...segment(0xe1, EXIF_PAYLOAD)]);

    const cleaned = stripJpeg(withIcc);

    expect(contains(cleaned, "ICC_PROFILE")).toBe(true);
    expect(contains(cleaned, "JFIF")).toBe(true);
  });

  it("leaves the pixels byte for byte alone", async () => {
    // Nothing is decoded or re-encoded, so the scan data must survive exactly.
    const cleaned = stripJpeg(jpeg(segment(0xe1, EXIF_PAYLOAD)));

    expect(Array.from(cleaned.subarray(cleaned.length - SCAN.length))).toEqual(SCAN);
  });

  it("hands back the very bytes it was given when there was no metadata", async () => {
    // Identity, not equality: copying the ranges would spend a pass over the
    // pixel data to rebuild bytes already in hand.
    const plain = jpeg();

    expect(stripJpeg(plain)).toBe(plain);
  });

  it("keeps quantisation and Huffman tables, which the image cannot be read without", async () => {
    const withTables = jpeg([...segment(0xdb, [0x00, 0x01, 0x02]), ...segment(0xc4, [0x00, 0x01])]);

    const cleaned = stripJpeg(withTables);

    expect(cleaned.length).toBe(withTables.length);
  });

  it("reads a marker that arrives behind padding", async () => {
    // A segment may be preceded by any number of 0xFF fill bytes, and treating
    // one as the marker itself would misread the rest of the file.
    const padded = bytes(0xff, 0xd8, 0xff, 0xff, 0xff, 0xe1, 0x00, 0x08, ...ascii("Exif\0\0"), ...SCAN);

    expect(contains(stripJpeg(padded), "Exif")).toBe(false);
  });

  it("keeps restart markers, which carry no length to skip past", async () => {
    const withRestart = bytes(0xff, 0xd8, 0xff, 0xd0, ...segment(0xe1, EXIF_PAYLOAD), ...SCAN);

    const cleaned = stripJpeg(withRestart);

    expect(Array.from(cleaned.subarray(0, 4))).toEqual([0xff, 0xd8, 0xff, 0xd0]);
    expect(contains(cleaned, "GPSLatitude")).toBe(false);
  });

  it("stops at an end marker that arrives before any scan", async () => {
    const empty = bytes(0xff, 0xd8, ...segment(0xe1, EXIF_PAYLOAD), 0xff, 0xd9);

    expect(Array.from(stripJpeg(empty))).toEqual([0xff, 0xd8, 0xff, 0xd9]);
  });

  it("refuses a segment whose length cannot even cover itself", async () => {
    const nonsense = bytes(0xff, 0xd8, 0xff, 0xe1, 0x00, 0x01, 0x00, 0x00);

    expect(() => stripJpeg(nonsense)).toThrow(UnreadableImageError);
  });

  it("refuses a file that ends mid-marker", async () => {
    expect(() => stripJpeg(bytes(0xff, 0xd8, 0xff))).toThrow(UnreadableImageError);
  });

  it("refuses a file too short to hold a header at all", async () => {
    expect(() => stripJpeg(bytes(0xff, 0xd8))).toThrow(UnreadableImageError);
  });

  it("refuses a file that starts with the wrong second byte", async () => {
    // 0xFF alone is not a JPEG; the start marker is the pair.
    expect(() => stripJpeg(bytes(0xff, 0x00, 0x00, 0x00))).toThrow(UnreadableImageError);
  });

  it("refuses a segment header cut short by the end of the file", async () => {
    expect(() => stripJpeg(bytes(0xff, 0xd8, 0xff, 0xe1, 0x00))).toThrow(UnreadableImageError);
  });

  it("keeps a marker it does not recognise rather than guessing", async () => {
    // 0xF0-0xFD are JPEG extensions. Unknown is not the same as metadata, and
    // dropping one would corrupt a file this has no business rewriting.
    const withExtension = jpeg([...segment(0xf1, ascii("extension payload")), ...segment(0xe1, EXIF_PAYLOAD)]);

    const cleaned = stripJpeg(withExtension);

    expect(contains(cleaned, "extension payload")).toBe(true);
    expect(contains(cleaned, "GPSLatitude")).toBe(false);
  });

  it("keeps the temporary marker, which also carries no length", async () => {
    const withTemp = bytes(0xff, 0xd8, 0xff, 0x01, ...segment(0xe1, EXIF_PAYLOAD), ...SCAN);

    const cleaned = stripJpeg(withTemp);

    expect(Array.from(cleaned.subarray(0, 4))).toEqual([0xff, 0xd8, 0xff, 0x01]);
    expect(contains(cleaned, "GPSLatitude")).toBe(false);
  });

  it("refuses padding that runs to the end of the file", async () => {
    expect(() => stripJpeg(bytes(0xff, 0xd8, 0xff, 0xff, 0xff, 0xff))).toThrow(UnreadableImageError);
  });

  it("refuses a file that is not a JPEG at all", async () => {
    expect(() => stripJpeg(bytes(0x25, 0x50, 0x44, 0x46))).toThrow(UnreadableImageError);
  });

  it("refuses a segment claiming to run past the end of the file", async () => {
    // A length longer than the data is how a parser is walked out of bounds.
    const lying = bytes(0xff, 0xd8, 0xff, 0xe1, 0x7f, 0xff, 0x00);

    expect(() => stripJpeg(lying)).toThrow(UnreadableImageError);
  });
});

describe("stripJpeg orientation", () => {
  /** EXIF as a TIFF document: byte-order mark, directory offset, one entry. */
  function exif(orientation: number, { littleEndian = false } = {}): number[] {
    const u16 = (value: number) => (littleEndian ? [value & 0xff, (value >> 8) & 0xff] : [(value >> 8) & 0xff, value & 0xff]);
    const u32 = (value: number) =>
      littleEndian
        ? [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff]
        : [(value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];

    return [
      ...ascii("Exif\0\0"),
      ...(littleEndian ? ascii("II") : ascii("MM")),
      ...u16(42),
      ...u32(8),
      ...u16(1),
      ...u16(0x0112),
      ...u16(3),
      ...u32(1),
      ...u16(orientation),
      0x00,
      0x00,
      ...u32(0),
    ];
  }

  const orientationOf = (cleaned: Uint8Array) => {
    // The rebuilt segment is fixed-width, so the value sits at a known offset
    // from the marker rather than needing the file re-parsed.
    const marker = cleaned.indexOf(0xe1);
    if (cleaned[marker - 1] !== 0xff) return null;
    // Counted from the 0xFF that starts the segment, not from the marker byte.
    return cleaned[marker - 1 + 29];
  };

  it("carries the orientation across, and nothing else from the block", async () => {
    // Otherwise a portrait photo that skipped the browser's resize is stored
    // with sideways pixels and no note saying to turn them.
    const portrait = jpeg(segment(0xe1, [...exif(6), ...ascii("GPSLatitude 14.5995")]));

    const cleaned = stripJpeg(portrait);

    expect(orientationOf(cleaned)).toBe(6);
    expect(contains(cleaned, "GPSLatitude")).toBe(false);
  });

  it("reads a block written the other way round", async () => {
    // Canon writes big-endian, most phones little-endian; both are valid EXIF.
    const cleaned = stripJpeg(jpeg(segment(0xe1, exif(8, { littleEndian: true }))));

    expect(orientationOf(cleaned)).toBe(8);
  });

  it("writes no block when the photo was already upright", async () => {
    // Orientation 1 means no rotation, so the tag would say nothing.
    const cleaned = stripJpeg(jpeg(segment(0xe1, [...exif(1), ...ascii("GPSLatitude")])));

    expect(contains(cleaned, "Exif")).toBe(false);
  });

  it("writes no block when the metadata never recorded one", async () => {
    const cleaned = stripJpeg(jpeg(segment(0xe1, [...ascii("Exif\0\0"), ...ascii("MM"), 0x00, 0x2a, 0, 0, 0, 8, 0x00, 0x00])));

    expect(contains(cleaned, "Exif")).toBe(false);
  });

  it("puts the segment where an application segment belongs", async () => {
    const cleaned = stripJpeg(jpeg(segment(0xe1, exif(3))));

    // Directly after the start-of-image marker, never before it.
    expect(Array.from(cleaned.subarray(0, 4))).toEqual([0xff, 0xd8, 0xff, 0xe1]);
  });

  it("ignores a block whose orientation is not a rotation", async () => {
    const cleaned = stripJpeg(jpeg(segment(0xe1, exif(99))));

    expect(contains(cleaned, "Exif")).toBe(false);
  });

  it("ignores a directory pointing outside the block it lives in", async () => {
    const lying = [...ascii("Exif\0\0"), ...ascii("MM"), 0x00, 0x2a, 0x7f, 0xff, 0xff, 0xff];
    const cleaned = stripJpeg(jpeg(segment(0xe1, lying)));

    expect(contains(cleaned, "Exif")).toBe(false);
  });

  it("takes the orientation from EXIF rather than from XMP alongside it", async () => {
    const withXmp = jpeg([...segment(0xe1, ascii("http://ns.adobe.com/xap/1.0/\0<x>author</x>")), ...segment(0xe1, exif(6))]);

    const cleaned = stripJpeg(withXmp);

    expect(orientationOf(cleaned)).toBe(6);
    expect(contains(cleaned, "adobe")).toBe(false);
  });
});

describe("stripPng", () => {
  const png = (extra: number[] = []) =>
    bytes(
      ...PNG_SIGNATURE,
      ...chunk("IHDR", [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]),
      ...extra,
      ...chunk("IDAT", [0x78, 0x9c]),
      ...chunk("IEND"),
    );

  it("hands back the very bytes it was given when there was no metadata", async () => {
    // Re-encoding copies the pixel payload several times to recompute
    // checksums it would not change.
    const plain = png();

    expect(stripPng(plain)).toBe(plain);
  });

  it("rebuilds when bytes are hiding past the end marker, even with no metadata", async () => {
    const trailing = bytes(...Array.from(png()), ...ascii("GPSLatitude 14.5995"));

    expect(stripPng(trailing)).not.toBe(trailing);
    expect(contains(stripPng(trailing), "GPSLatitude")).toBe(false);
  });

  it("removes the EXIF chunk", async () => {
    const withExif = png(chunk("eXIf", ascii("GPSLatitude 14.5995")));

    expect(contains(stripPng(withExif), "GPSLatitude")).toBe(false);
  });

  it("removes text chunks and the timestamp", async () => {
    const noisy = png([
      ...chunk("tEXt", ascii("Author\0Karl")),
      ...chunk("iTXt", ascii("Comment\0home address")),
      ...chunk("tIME", [0x07, 0xea, 0x08, 0x05, 0x0c, 0x00, 0x00]),
    ]);

    const cleaned = stripPng(noisy);

    expect(contains(cleaned, "Karl")).toBe(false);
    expect(contains(cleaned, "home address")).toBe(false);
    expect(contains(cleaned, "tIME")).toBe(false);
  });

  it("keeps the chunks the image is made of", async () => {
    const cleaned = stripPng(png(chunk("tEXt", ascii("Author\0Karl"))));

    expect(contains(cleaned, "IHDR")).toBe(true);
    expect(contains(cleaned, "IDAT")).toBe(true);
    expect(contains(cleaned, "IEND")).toBe(true);
  });

  it("keeps colour chunks that change how the image renders", async () => {
    const withProfile = png([...chunk("iCCP", ascii("sRGB\0")), ...chunk("gAMA", [0, 0, 0, 1])]);

    const cleaned = stripPng(withProfile);

    expect(contains(cleaned, "iCCP")).toBe(true);
    expect(contains(cleaned, "gAMA")).toBe(true);
  });

  it("drops anything hidden after the end marker", async () => {
    const trailing = bytes(...Array.from(png()), ...ascii("GPSLatitude 14.5995"));

    expect(contains(stripPng(trailing), "GPSLatitude")).toBe(false);
  });

  it("refuses a file that ends before its end marker", async () => {
    // A truncated upload is damaged, not merely unfamiliar. Rewriting one could
    // only produce something more broken, so the caller stores it as it came.
    const truncated = bytes(...PNG_SIGNATURE, ...chunk("IHDR", [0, 0, 0, 1]), 0x00, 0x00);

    expect(() => stripPng(truncated)).toThrow(UnreadableImageError);
  });

  it("refuses a file whose checksums do not match its contents", async () => {
    // Corruption the hand-written walk used to ignore: chunks were dropped
    // without ever reading a CRC, so a damaged file was rewritten regardless.
    const corrupt = bytes(...PNG_SIGNATURE, ...chunk("IHDR", [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]).slice(0, -1), 0x00);

    expect(() => stripPng(corrupt)).toThrow(UnreadableImageError);
  });

  it("refuses a file that is not a PNG at all", async () => {
    expect(() => stripPng(bytes(0xff, 0xd8, 0xff, 0xe0))).toThrow(UnreadableImageError);
  });

  it("refuses a file too short to hold the signature", async () => {
    expect(() => stripPng(bytes(0x89, 0x50, 0x4e))).toThrow(UnreadableImageError);
  });

  it("refuses a chunk that declares more bytes than the file holds, without allocating them", async () => {
    // png-chunks-extract sizes its buffer from the declared length before
    // checking it: this twenty-byte file cost a 2GB allocation and 28 seconds
    // of CPU before the library rejected it, from an endpoint any signed-in
    // user can reach.
    const hostile = bytes(...PNG_SIGNATURE, 0x7f, 0xff, 0xff, 0xff, ...ascii("IHDR"), 0, 0, 0, 0);

    const started = Date.now();
    expect(() => stripPng(hostile)).toThrow(UnreadableImageError);
    expect(Date.now() - started).toBeLessThan(100);
  });

  it("refuses a chunk length with the top bit set", async () => {
    // 0x80000000 read as a signed integer is negative, which walked the cursor
    // backwards and spun until the isolate was killed — a hang any uploader
    // could trigger with twenty bytes.
    const hostile = bytes(...PNG_SIGNATURE, 0x80, 0x00, 0x00, 0x00, ...ascii("eXIf"), 0, 0, 0, 0);

    expect(() => stripPng(hostile)).toThrow(UnreadableImageError);
  });

  it("refuses a chunk claiming to run past the end of the file", async () => {
    const lying = bytes(...PNG_SIGNATURE, 0x7f, 0xff, 0xff, 0xff, ...ascii("eXIf"));

    expect(() => stripPng(lying)).toThrow(UnreadableImageError);
  });
});

describe("stripImageMetadata", () => {
  it("hands back a file of the same name and type", async () => {
    const file = new File([jpeg(segment(0xe1, EXIF_PAYLOAD)) as BlobPart], "selfie.jpg", { type: "image/jpeg" });

    const cleaned = await stripImageMetadata(file);

    expect(cleaned.name).toBe("selfie.jpg");
    expect(cleaned.type).toBe("image/jpeg");
    expect(cleaned.size).toBeLessThan(file.size);
    expect(contains(new Uint8Array(await cleaned.arrayBuffer()), "GPSLatitude")).toBe(false);
  });

  it("hands back the very same file when there was nothing to remove", async () => {
    // No copy is made, so an upload of an already-clean image costs nothing.
    const file = new File([jpeg() as BlobPart], "clean.jpg", { type: "image/jpeg" });

    await expect(stripImageMetadata(file)).resolves.toBe(file);
  });

  it("leaves a video or document alone rather than corrupting it", async () => {
    const video = new File([bytes(0x00, 0x00, 0x00, 0x18) as BlobPart], "clip.mp4", { type: "video/mp4" });

    await expect(stripImageMetadata(video)).resolves.toBe(video);
  });

  it("stores a file it cannot parse as it arrived rather than failing the upload", async () => {
    // Whether a file is acceptable is the upload route's judgement, not this
    // one's; a container this cannot read is also one it cannot safely rewrite.
    const lying = new File([bytes(0x25, 0x50, 0x44, 0x46) as BlobPart], "notes.jpg", { type: "image/jpeg" });

    await expect(stripImageMetadata(lying)).resolves.toBe(lying);
  });

  it("still strips every image it can read", async () => {
    // The pass-through above must not become a way to smuggle EXIF past this:
    // a readable JPEG is cleaned whatever else is going on.
    const file = new File([jpeg(segment(0xe1, EXIF_PAYLOAD)) as BlobPart], "ok.jpg", { type: "image/jpeg" });

    const cleaned = await stripImageMetadata(file);

    expect(contains(new Uint8Array(await cleaned.arrayBuffer()), "GPSLatitude")).toBe(false);
  });
});

describe("the strippable list and the buckets agree", () => {
  it("handles every image type a bucket accepts", () => {
    // A type added to policy.ts without a case in strip-metadata.ts would be
    // stored with its EXIF intact, and nothing else would say so.
    const acceptedImages = STORAGE_BUCKETS.flatMap((bucket) =>
      ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/avif", "image/tiff"].filter((type) =>
        validateFileType(bucket, type),
      ),
    );

    expect([...new Set(acceptedImages)].sort()).toEqual([...STRIPPABLE_TYPES].sort());
  });
});
