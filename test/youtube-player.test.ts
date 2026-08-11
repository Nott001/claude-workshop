import { describe, it, expect } from "vitest";
import { getYouTubeVideoId } from "@/modules/courses/components/youtube-player";

describe("getYouTubeVideoId", () => {
  it("reads the id from a watch URL", () => {
    expect(getYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(getYouTubeVideoId("https://youtube.com/watch?v=dQw4w9WgXcQ&t=30")).toBe("dQw4w9WgXcQ");
    expect(getYouTubeVideoId("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("reads the id from an embed URL", () => {
    expect(getYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(getYouTubeVideoId("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("reads the id from a youtu.be short URL", () => {
    expect(getYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(getYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ?t=30")).toBe("dQw4w9WgXcQ");
  });

  it("ignores case in the hostname", () => {
    expect(getYouTubeVideoId("https://WWW.YouTube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("rejects hosts that merely contain a YouTube domain", () => {
    expect(getYouTubeVideoId("https://youtube.com.attacker.example/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(getYouTubeVideoId("https://notyoutube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(getYouTubeVideoId("https://attacker.example/youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(getYouTubeVideoId("https://youtu.be.attacker.example/dQw4w9WgXcQ")).toBeNull();
    expect(getYouTubeVideoId("https://attacker.example/watch?v=dQw4w9WgXcQ#youtube.com")).toBeNull();
  });

  it("rejects non-http schemes", () => {
    expect(getYouTubeVideoId("javascript:alert(1)//youtube.com/watch?v=x")).toBeNull();
  });

  it("returns null for malformed or unrelated URLs", () => {
    expect(getYouTubeVideoId("not a url")).toBeNull();
    expect(getYouTubeVideoId("")).toBeNull();
    expect(getYouTubeVideoId("https://www.youtube.com/")).toBeNull();
    expect(getYouTubeVideoId("https://www.youtube.com/watch")).toBeNull();
    expect(getYouTubeVideoId("https://youtu.be/")).toBeNull();
  });
});
