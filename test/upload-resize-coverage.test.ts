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
/** Modules that put a file into an upload body. */
function uploadModules(): string[] {
  return globSync("**/*.{ts,tsx}", { cwd: SRC_DIR }).filter((rel) =>
    /\.append\(\s*["']file["']/.test(readFileSync(path.join(SRC_DIR, rel), "utf8")),
  );
}

describe("upload resize sweep", () => {
  const modules = uploadModules();

  it("finds the upload sites to check", () => {
    // Cover image, profile photo and course lesson. A drop to zero would make
    // the assertion below vacuous; a rise is a new site, which is the point.
    expect(modules.length).toBeGreaterThanOrEqual(3);
  });

  it("gives every module that posts a file access to the resizer", () => {
    // Deliberately an import check rather than a call-shape one. An earlier
    // version matched the text at the append site and failed the moment a call
    // site correctly hoisted the resize above an unrelated request to overlap
    // them — a guard that rejects better code is worse than no guard. Proving
    // the resize actually runs is `test/cover-image-upload.test.tsx`'s job.
    for (const rel of modules) {
      const source = readFileSync(path.join(SRC_DIR, rel), "utf8");
      expect(source, `${rel} posts a file but never imports resizeImage`).toMatch(
        /import .*resizeImage.* from ".*storage\/resize-image"/,
      );
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
