/**
 * Byte-level PNG fixtures for the metadata stripper's tests.
 *
 * The checksum is written out rather than imported from `crc-32` so a fixture
 * owes nothing to the library under test: a chunk built here is one a real
 * encoder would have written, and a test asserting that chunk survived cannot
 * pass because both sides share a mistake.
 */

export const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export const ascii = (text: string) => Array.from(text, (character) => character.charCodeAt(0));

export function crc32(data: number[]): number {
  let crc = 0xffffffff;

  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

/** A PNG chunk: big-endian length, four-character type, payload, checksum. */
export function chunk(type: string, payload: number[] = []): number[] {
  const body = [...ascii(type), ...payload];
  const crc = crc32(body);
  const length = payload.length;

  return [
    (length >>> 24) & 0xff,
    (length >>> 16) & 0xff,
    (length >>> 8) & 0xff,
    length & 0xff,
    ...body,
    (crc >>> 24) & 0xff,
    (crc >>> 16) & 0xff,
    (crc >>> 8) & 0xff,
    crc & 0xff,
  ];
}
