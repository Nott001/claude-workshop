import { describe, it, expect } from "vitest";
import { stripJpeg, stripPng, UnreadableImageError } from "@/shared/integrations/storage/strip-metadata";
import { ascii, chunk, PNG_SIGNATURE } from "./helpers/png-fixture";

/**
 * Hostile input against the container parsers.
 *
 * A hand-written walk over attacker-supplied lengths is where this kind of code
 * fails, and it already has once: a PNG chunk length of 0x80000000 read as a
 * signed integer sent the cursor backwards and spun until the isolate was
 * killed. Anyone who can upload a profile photo can reach these functions, so
 * "throws or returns" is the contract, and it has to hold for bytes nobody
 * wrote on purpose.
 */

/** Seeded so a failure names the exact input that caused it. */
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state;
  };
}

const VALID_JPEG = [
  0xff,
  0xd8,
  0xff,
  0xe0,
  0x00,
  0x07,
  ...ascii("JFIF\0"),
  0xff,
  0xe1,
  0x00,
  0x0c,
  ...ascii("Exif\0\0GPS"),
  0xff,
  0xda,
  0x00,
  0x08,
  0x01,
  0x01,
  0x00,
  0x00,
  0x3f,
  0x00,
  0x12,
  0xff,
  0xd9,
];

const VALID_PNG = [
  ...PNG_SIGNATURE,
  ...chunk("IHDR", [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]),
  ...chunk("eXIf", ascii("GPSLatitude")),
  ...chunk("IDAT", [0x78, 0x9c]),
  ...chunk("IEND"),
];

/** Either answer is acceptable; hanging, crashing or growing the file is not. */
function survives(strip: (b: Uint8Array) => Uint8Array, input: Uint8Array, label: string) {
  let output: Uint8Array | null = null;
  try {
    output = strip(input);
  } catch (err) {
    expect(err, label).toBeInstanceOf(UnreadableImageError);
    return;
  }
  expect(output, label).toBeInstanceOf(Uint8Array);
  expect(output!.length, label).toBeLessThanOrEqual(input.length);
}

describe("the parsers survive input nobody wrote on purpose", () => {
  it("answers for random bytes claiming to be a JPEG", () => {
    const next = random(20260806);

    for (let round = 0; round < 2000; round++) {
      const length = next() % 64;
      const input = Uint8Array.from([0xff, 0xd8, ...Array.from({ length }, () => next() & 0xff)]);
      survives(stripJpeg, input, `jpeg round ${round}`);
    }
  });

  it("answers for random bytes claiming to be a PNG", () => {
    const next = random(20260807);

    for (let round = 0; round < 2000; round++) {
      const length = next() % 64;
      const input = Uint8Array.from([...PNG_SIGNATURE, ...Array.from({ length }, () => next() & 0xff)]);
      survives(stripPng, input, `png round ${round}`);
    }
  });

  it("answers for a real image with one byte corrupted", () => {
    // The likeliest hostile input is not random noise but a valid file with a
    // length field edited, which is what walks a parser off its own buffer.
    const next = random(20260808);

    for (let round = 0; round < 2000; round++) {
      const jpeg = Uint8Array.from(VALID_JPEG);
      jpeg[2 + (next() % (jpeg.length - 2))] = next() & 0xff;
      survives(stripJpeg, jpeg, `jpeg mutation ${round}`);

      const png = Uint8Array.from(VALID_PNG);
      png[8 + (next() % (png.length - 8))] = next() & 0xff;
      survives(stripPng, png, `png mutation ${round}`);
    }
  });

  it("answers for every truncation of a valid image", () => {
    for (let length = 0; length < VALID_JPEG.length; length++) {
      survives(stripJpeg, Uint8Array.from(VALID_JPEG.slice(0, length)), `jpeg cut at ${length}`);
    }
    for (let length = 0; length < VALID_PNG.length; length++) {
      survives(stripPng, Uint8Array.from(VALID_PNG.slice(0, length)), `png cut at ${length}`);
    }
  });

  it("never leaves the EXIF marker behind on a file it accepted", () => {
    // The failure that matters most is silent: a file that comes back looking
    // fine while the coordinates are still in it.
    const next = random(20260809);
    const decode = (b: Uint8Array) => Array.from(b, (c) => String.fromCharCode(c)).join("");

    for (let round = 0; round < 500; round++) {
      const jpeg = Uint8Array.from(VALID_JPEG);
      // Mutate only the scan data, leaving the segment structure intact.
      jpeg[jpeg.length - 4] = next() & 0xff;

      let output: Uint8Array;
      try {
        output = stripJpeg(jpeg);
      } catch {
        continue;
      }
      expect(decode(output), `round ${round}`).not.toContain("Exif");
    }
  });
});
