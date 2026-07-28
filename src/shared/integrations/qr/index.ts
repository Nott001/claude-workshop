import QRCode from "qrcode";

export async function generateQRDataUrl(token: string): Promise<string> {
  return QRCode.toDataURL(token, {
    width: 300,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
}
