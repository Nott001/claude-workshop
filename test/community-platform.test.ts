import { describe, it, expect } from "vitest";
import { platformFromUrl } from "@/modules/community/lib/community-platform";

describe("platformFromUrl", () => {
  it("names the platform a known host belongs to", () => {
    expect(platformFromUrl("https://facebook.com/groups/startuplab")?.name).toBe("Facebook");
    expect(platformFromUrl("https://discord.gg/abc123")?.name).toBe("Discord");
    expect(platformFromUrl("https://m.me/startuplab")?.name).toBe("Messenger");
  });

  it("resolves a subdomain through its registrable domain", () => {
    expect(platformFromUrl("https://chat.whatsapp.com/abc")?.name).toBe("WhatsApp");
  });

  it("ignores www and the scheme", () => {
    expect(platformFromUrl("http://www.linkedin.com/groups/42")?.name).toBe("LinkedIn");
  });

  it("falls back to the bare hostname for a host it does not know", () => {
    expect(platformFromUrl("https://forum.startuplab.ph/c/ai")).toEqual({
      name: "forum.startuplab.ph",
      icon: "public",
    });
  });

  it("returns null when the URL will not parse", () => {
    expect(platformFromUrl("not a url")).toBeNull();
  });
});
