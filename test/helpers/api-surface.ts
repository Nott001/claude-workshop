import { readFileSync, globSync } from "node:fs";
import path from "node:path";

const SRC_DIR = path.resolve(__dirname, "../../src");

export const API_DIR = path.join(SRC_DIR, "app/api");

export interface ApiSourceFile {
  /** Path relative to `src`, e.g. `app/api/events/route.ts`. */
  rel: string;
  /** The file with its comments removed, so a scan matches code and not prose. */
  code: string;
}

const toPosix = (file: string) => file.replace(/\\/g, "/");
const read = (rel: string): ApiSourceFile => ({ rel, code: stripComments(readFileSync(path.join(SRC_DIR, rel), "utf8")) });

/**
 * These files explain the shapes they render, so the words a scan looks for
 * appear in their own documentation — `api-response.ts` names `flatten()` in
 * the comment saying why it no longer calls it. Line comments are cut only
 * where the slashes follow whitespace, which leaves the `//` of a URL alone.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
}

/** Every `route.ts` under `src/app/api`, relative to that directory. */
export function routeFiles(): string[] {
  return globSync("**/route.ts", { cwd: API_DIR }).map(toPosix).sort();
}

/**
 * Every file whose body an API client actually reads: the routes, plus the
 * helpers outside `src/app/api` whose responses routes hand back unchanged.
 *
 * Scanning the routes alone leaves the helpers unwatched, and the helpers are
 * where the error shape drifted both times. They are discovered by the response
 * they construct rather than listed by name, so a helper written next week is
 * covered without anyone remembering to add it here.
 */
export function apiResponders(): ApiSourceFile[] {
  const routes = routeFiles().map((rel) => read(`app/api/${rel}`));
  const helpers = globSync("**/*.ts", { cwd: SRC_DIR })
    .map(toPosix)
    .filter((rel) => !rel.startsWith("app/api/"))
    .sort()
    .map(read)
    .filter(({ code }) => /Response\.json\(/.test(code));

  return [...routes, ...helpers];
}
