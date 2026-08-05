import QRCode from "qrcode";

/**
 * The web QR, rendered wherever the token already is — which is the browser.
 *
 * Kept apart from `generateQRDataUrl` because the two have opposite
 * constraints. That one encodes a PNG through pngjs and zlib, ~20x the work of
 * this, and it stays PNG because email clients render SVG inconsistently. The
 * web has no such problem, so the ticket page renders its own and the Worker
 * never spends CPU on a code the holder could draw themselves.
 */
export async function renderQrSvg(token: string): Promise<string> {
  return QRCode.toString(token, { type: "svg", width: 300, margin: 2, color: { dark: "#000000", light: "#ffffff" } });
}
