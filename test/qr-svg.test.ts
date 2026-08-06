import { describe, it, expect } from "vitest";
import { renderQrSvg } from "@/shared/integrations/qr/svg";
import { generateQRDataUrl } from "@/shared/integrations/qr";

describe("renderQrSvg", () => {
  it("encodes the token as SVG markup", async () => {
    const svg = await renderQrSvg("ticket-token-abc");

    // The format assertion is the point: a regression to the PNG encoder would
    // still produce a working code, and would silently put ~20x the CPU back
    // wherever this runs.
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("viewBox");
    expect(svg).not.toContain("data:image/png");
  });

  it("varies with the token, so a card cannot render another ticket's code", async () => {
    const [a, b] = await Promise.all([renderQrSvg("token-a"), renderQrSvg("token-b")]);

    expect(a).not.toEqual(b);
  });
});

describe("generateQRDataUrl", () => {
  it("stays a PNG data URL, which is what email clients render", async () => {
    // SVG is unreliable across mail clients, so the email path deliberately
    // keeps the expensive encoder. See src/shared/integrations/qr/svg.ts.
    const dataUrl = await generateQRDataUrl("ticket-token-abc");

    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });
});
