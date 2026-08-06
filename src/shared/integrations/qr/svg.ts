"use client";

import QRCode from "qrcode";
import { QR_STYLE } from "./index";

/**
 * The web QR, rendered wherever the token already is — which is the browser.
 *
 * Kept apart from `generateQRDataUrl` because the two have opposite
 * constraints: that one encodes a PNG through pngjs and zlib, measured at
 * ~12x the cost of this, and it stays PNG because email clients render SVG
 * inconsistently. Nothing on the web needs that trade.
 */
export async function renderQrSvg(token: string): Promise<string> {
  return QRCode.toString(token, { ...QR_STYLE, type: "svg" });
}
