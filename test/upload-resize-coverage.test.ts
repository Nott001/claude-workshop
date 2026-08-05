import { describe, it, expect } from "vitest";
import { readFileSync, globSync } from "node:fs";
import path from "node:path";

const SRC_DIR = path.resolve(__dirname, "../src");

/**
 * Resizing moved into the browser when photon proved unshippable on workerd, so
 * the only thing standing between an upload and a full-size phone photo is a
 * call at each site that builds the form. Deleting one breaks nothing that any
 * other test observes: `resizeImage` keeps passing its own suite, the routes
 * keep accepting the file, and uploads quietly go back to several megabytes.
 *
 * A sweep rather than three tests, so a fourth upload site is covered the day
 * it is written instead of the day someone remembers this file exists.
 */
const FILE_APPEND = /formData\.append\(\s*"file"\s*,([^)]*)\)/g;

function sourceFiles(): string[] {
  return globSync("**/*.{ts,tsx}", { cwd: SRC_DIR })
    .sort()
    .map((f) => f.replace(/\\/g, "/"));
}

/** Every `formData.append("file", …)` in src/, with the expression it appends. */
function fileAppends(): Array<{ file: string; expression: string }> {
  const found: Array<{ file: string; expression: string }> = [];
  for (const rel of sourceFiles()) {
    const source = readFileSync(path.join(SRC_DIR, rel), "utf8");
    for (const [, expression] of source.matchAll(FILE_APPEND)) {
      found.push({ file: rel, expression: expression.trim() });
    }
  }
  return found;
}

describe("upload resize sweep", () => {
  const appends = fileAppends();

  it("finds the upload sites to check", () => {
    // Cover image, profile photo and course lesson. If this drops, the regex
    // stopped matching and every assertion below became vacuous.
    expect(appends.length).toBe(3);
  });

  it("resizes at every site that posts a file", () => {
    for (const { file, expression } of appends) {
      expect(expression, `${file} posts a file without passing it through resizeImage`).toMatch(/resizeImage\(/);
    }
  });

  it("awaits the resize rather than posting the promise", () => {
    // `resizeImage` is async. Appending it unawaited puts "[object Promise]"
    // in the request body, which the route rejects as a missing file.
    for (const { file, expression } of appends) {
      expect(expression, `${file} appends the resize promise instead of its result`).toMatch(/await\s+resizeImage\(/);
    }
  });

  it("keeps the server routes out of the resizing business", () => {
    // The counterpart to the above: workerd cannot run the resizer at all, so
    // a route that reaches for one is broken before it ships.
    for (const rel of globSync("**/route.ts", { cwd: path.join(SRC_DIR, "app/api/upload") })) {
      const source = readFileSync(path.join(SRC_DIR, "app/api/upload", rel), "utf8");
      expect(source, `${rel} resizes on the server`).not.toMatch(/optimizeImage|resizeImage|@cf-wasm/);
    }
  });
});
