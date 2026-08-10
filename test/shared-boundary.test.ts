import { describe, it, expect } from "vitest";
import { readFileSync, globSync } from "node:fs";
import path from "node:path";

const SHARED_DIR = path.resolve(__dirname, "../src/shared");

function sharedFiles(): string[] {
  return globSync("**/*.{ts,tsx}", { cwd: SHARED_DIR })
    .sort()
    .map((f) => f.replace(/\\/g, "/"));
}

// Matches both static `from "..."` imports and dynamic `import("...")` /
// `await import("...")`, so a lazy import cannot smuggle in the dependency.
const importsModule = (rel: string) =>
  /(from\s+["']@\/modules\/|import\(\s*["']@\/modules\/)/.test(readFileSync(path.join(SHARED_DIR, rel), "utf8"));

describe("shared layer boundary", () => {
  const files = sharedFiles();

  it("finds the shared files to check", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it("no file in src/shared imports from a module", () => {
    const offenders = files.filter(importsModule);

    expect(offenders, `Files importing @/modules/*:\n  ${offenders.join("\n  ")}`).toEqual([]);
  });
});
