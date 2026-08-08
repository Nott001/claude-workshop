import { describe, it, expect } from "vitest";
import { readFileSync, globSync } from "node:fs";
import path from "node:path";

const EVENTS_DIR = path.resolve(__dirname, "../src/modules/events");
const EVENTS_SIBLINGS = ["courses", "chat", "commerce", "kiosk"];

const moduleFiles = (dir: string): string[] =>
  globSync("**/*.{ts,tsx}", { cwd: dir })
    .sort()
    .map((f) => f.replace(/\\/g, "/"));

// Matches both static `from "..."` imports and dynamic `import("...")` /
// `await import("...")`, so a lazy import cannot smuggle in the dependency.
const hasImport = (dir: string, rel: string, target: string) =>
  new RegExp(`(from\\s+["']${target}|import\\(\\s*["']${target})`).test(readFileSync(path.join(dir, rel), "utf8"));

describe("events module boundary", () => {
  const eventsFiles = moduleFiles(EVENTS_DIR);

  it("finds the events module files to check", () => {
    expect(eventsFiles.length).toBeGreaterThan(5);
  });

  it("no file in src/modules/events imports from the app tree", () => {
    const offenders = eventsFiles.filter((f) => hasImport(EVENTS_DIR, f, "@/app"));

    expect(offenders, `Files importing @/app:\n  ${offenders.join("\n  ")}`).toEqual([]);
  });

  for (const sibling of EVENTS_SIBLINGS) {
    const dir = path.resolve(__dirname, `../src/modules/${sibling}`);
    const files = moduleFiles(dir);

    it(`no file in src/modules/${sibling} imports from the events module`, () => {
      const offenders = files.filter((f) => hasImport(dir, f, "@/modules/events"));

      expect(offenders, `Files importing @/modules/events:\n  ${offenders.join("\n  ")}`).toEqual([]);
    });
  }
});
