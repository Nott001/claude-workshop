/** RFC 2045 caps an encoded line at 76 characters. */
const BASE64_LINE_LENGTH = 76;

/** Spreading a large Uint8Array into fromCharCode overflows the call stack. */
const CHUNK_SIZE = 0x8000;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK_SIZE));
  }
  return btoa(binary);
}

export function utf8ToBase64(value: string): string {
  return bytesToBase64(new TextEncoder().encode(value));
}

export function foldBase64(encoded: string, lineLength = BASE64_LINE_LENGTH): string {
  const lines: string[] = [];
  for (let offset = 0; offset < encoded.length; offset += lineLength) {
    lines.push(encoded.slice(offset, offset + lineLength));
  }
  return lines.join("\r\n");
}
