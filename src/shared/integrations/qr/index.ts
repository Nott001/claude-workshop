import QRCode from "qrcode";

/** Shared so the emailed code and the one on screen cannot drift apart. */
export const QR_STYLE = {
  width: 300,
  margin: 2,
  color: { dark: "#000000", light: "#ffffff" },
} as const;

export async function generateQRDataUrl(token: string): Promise<string> {
  return QRCode.toDataURL(token, { ...QR_STYLE });
}
