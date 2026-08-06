import { describe, it, expect } from "vitest";
import { readFileSync, globSync } from "node:fs";
import path from "node:path";

const COURSES_DIR = path.resolve(__dirname, "../src/modules/courses");

function moduleFiles(): string[] {
  return globSync("**/*.{ts,tsx}", { cwd: COURSES_DIR })
    .sort()
    .map((f) => f.replace(/\\/g, "/"));
}

// Matches both static `from "..."` imports and dynamic `import("...")` /
// `await import("...")`, so a lazy import cannot smuggle in the dependency.
const importsEvents = (rel: string) =>
  /(from\s+["']@\/modules\/events|import\(\s*["']@\/modules\/events)/.test(readFileSync(path.join(COURSES_DIR, rel), "utf8"));

describe("course module boundary", () => {
  const files = moduleFiles();

  it("finds the course module files to check", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it("no file in src/modules/courses imports from the events module", () => {
    const offenders = files.filter(importsEvents);

    expect(offenders, `Files importing @/modules/events:\n  ${offenders.join("\n  ")}`).toEqual([]);
  });
});
