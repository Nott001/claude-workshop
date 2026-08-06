import { describe, it, expect } from "vitest";
import { sanitizeObjectName } from "@/shared/integrations/storage/policy";

describe("sanitizeObjectName", () => {
  it("keeps a plain filename", () => {
    expect(sanitizeObjectName("slides.pdf", "asset.bin")).toBe("slides.pdf");
  });

  it("keeps the final segment of a posix path", () => {
    expect(sanitizeObjectName("../../1/lessons/2/evil.pdf", "asset.bin")).toBe("evil.pdf");
  });

  it("keeps the final segment of a windows path", () => {
    expect(sanitizeObjectName("C:\\lessons\\leak.mp4", "video.bin")).toBe("leak.mp4");
  });

  it("falls back for a name that is only dots", () => {
    expect(sanitizeObjectName("..", "asset.bin")).toBe("asset.bin");
    expect(sanitizeObjectName("....", "asset.bin")).toBe("asset.bin");
  });

  it("falls back for an empty or absent name", () => {
    expect(sanitizeObjectName("", "asset.bin")).toBe("asset.bin");
    expect(sanitizeObjectName("/", "asset.bin")).toBe("asset.bin");
  });
});
