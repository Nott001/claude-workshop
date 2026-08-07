import { describe, it, expect } from "vitest";
import { readFileSync, globSync } from "node:fs";
import path from "node:path";

const SRC_DIR = path.resolve(__dirname, "../src");

/**
 * `postUpload` is the only browser-side path to an upload route: it validates
 * against the bucket, resizes, and posts. What is left to guard is that nobody
 * builds a request around it by hand.
 *
 * An earlier version of this file matched the text at each `formData.append`
 * site instead, and rejected a correct refactor that hoisted the resize. The
 * abstraction removed the thing that needed guarding, which is why what remains
 * is two directory-level checks rather than assertions about call shape.
 */
describe("upload path", () => {
  it("routes every browser upload through postUpload", () => {
    const handRolled = globSync("**/*.{ts,tsx}", { cwd: SRC_DIR })
      // glob returns backslash paths on Windows; normalize so the comparisons below hold everywhere.
      .map((rel) => rel.replaceAll("\\", "/"))
      .filter((rel) => {
        if (rel.startsWith("app/api/")) return false; // routes receive uploads, they do not send them
        if (rel === "shared/integrations/storage/upload-client.ts") return false;
        return /\.append\(\s*["']file["']/.test(readFileSync(path.join(SRC_DIR, rel), "utf8"));
      });

    expect(handRolled, "builds an upload body by hand instead of calling postUpload").toEqual([]);
  });

  it("keeps the server routes out of the resizing business", () => {
    // The counterpart: workerd cannot run the resizer at all, so a route that
    // reaches for one is broken before it ships.
    for (const rel of globSync("**/route.ts", { cwd: path.join(SRC_DIR, "app/api/upload") })) {
      const source = readFileSync(path.join(SRC_DIR, "app/api/upload", rel), "utf8");
      expect(source, `${rel} resizes on the server`).not.toMatch(/optimizeImage|resizeImage|@cf-wasm/);
    }
  });
});
