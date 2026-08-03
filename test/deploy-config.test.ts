import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The Cloudflare deploy has no staging rehearsal — `pnpm dev` runs on Node and
 * proves nothing about an isolate. These assertions cover the mismatches that
 * only surface after the worker is already live: a missing compatibility flag,
 * a build-time variable nobody passed to the build, a deploy that ships a
 * different commit from the one CI verified.
 */
const wranglerSource = readFileSync("wrangler.jsonc", "utf8");
const deployWorkflow = readFileSync(".github/workflows/deploy.yml", "utf8");

/**
 * Minimal JSONC reader: strips comments and trailing commas. Sufficient for a
 * file we own and keep free of `//` inside string values.
 */
function readWranglerConfig(): Record<string, unknown> {
  const stripped = wranglerSource
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(stripped);
}

/** Every `process.env.NEXT_PUBLIC_*` name the application source reads. */
function publicEnvNames(dir = "src"): Set<string> {
  const names = new Set<string>();
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const name of publicEnvNames(path)) names.add(name);
    } else if (/\.tsx?$/.test(entry.name)) {
      for (const [, name] of readFileSync(path, "utf8").matchAll(/process\.env\.(NEXT_PUBLIC_[A-Z0-9_]+)/g)) {
        names.add(name);
      }
    }
  }
  return names;
}

describe("wrangler configuration", () => {
  it("enables nodejs_compat while the source imports a Node builtin", () => {
    // src/modules/commerce/index.ts imports the bare `crypto` specifier. An
    // isolate has no Node builtins without the flag, so dropping either one
    // without the other is a runtime failure on the first signed payment.
    const importsNodeBuiltin = /^import\s+\w+\s+from\s+"(node:)?crypto"/m.test(
      readFileSync("src/modules/commerce/index.ts", "utf8"),
    );
    const flags = readWranglerConfig().compatibility_flags as string[];

    expect(importsNodeBuiltin).toBe(true);
    expect(flags).toContain("nodejs_compat");
  });

  it("points at the artefacts the OpenNext build emits", () => {
    const config = readWranglerConfig();
    const assets = config.assets as { directory: string; binding: string };

    expect(config.main).toBe(".open-next/worker.js");
    expect(assets.directory).toBe(".open-next/assets");
  });

  it("keeps the generated worker types out of the app typecheck", () => {
    // `wrangler types` emits workerd's runtime lib, which redeclares fetch and
    // Response against DOM's. Letting tsc see it turned every `res.json()` in
    // src/ into `unknown` — 14 errors in files nobody had touched.
    const tsconfig = JSON.parse(readFileSync("tsconfig.json", "utf8")) as { exclude: string[] };
    expect(tsconfig.exclude).toContain("cloudflare-env.d.ts");
  });

  it("keeps the build output out of git", () => {
    // A committed `.open-next/` would be stale on the next deploy and would put
    // a bundled copy of every server secret reference into the repository.
    const gitignore = readFileSync(".gitignore", "utf8");
    expect(gitignore).toMatch(/^\/\.open-next\/$/m);
    expect(gitignore).toMatch(/^\.dev\.vars\*$/m);
  });
});

describe("deploy workflow", () => {
  it("gates on workflows that exist", () => {
    const gated = deployWorkflow.match(/workflows:\s*\[(.+)\]/)?.[1] ?? "";
    const required = gated.split(",").map((name) => name.trim());
    const declared = readdirSync(".github/workflows")
      .filter((file) => file !== "deploy.yml")
      .map((file) =>
        readFileSync(join(".github/workflows", file), "utf8")
          .match(/^name:\s*(.+)$/m)?.[1]
          .trim(),
      );

    expect(required).toEqual(["CI", "Security", "E2E"]);
    for (const name of required) expect(declared).toContain(name);
  });

  it("deploys the commit the checks ran against", () => {
    // workflow_run fires after the fact; checking out the branch tip instead of
    // head_sha would ship whatever landed in the meantime, unverified.
    expect(deployWorkflow).toMatch(/ref:\s*\$\{\{\s*needs\.gate\.outputs\.sha\s*\}\}/);
    expect(deployWorkflow).toContain("github.event.workflow_run.head_sha");
  });

  it("supplies every build-time public variable the source reads", () => {
    // NEXT_PUBLIC_* values are inlined by the compiler, so one missing here is
    // baked into the bundle as `undefined` — a worker secret cannot repair it.
    for (const name of publicEnvNames()) {
      expect(deployWorkflow, `${name} is read by src/ but never set for the build`).toMatch(
        new RegExp(`^\\s+${name}:\\s*\\$\\{\\{`, "m"),
      );
    }
  });

  it("does not cancel a deploy in flight", () => {
    const cancel = deployWorkflow.match(/cancel-in-progress:\s*(.+)/)?.[1].trim();
    expect(cancel).toBe("false");
  });
});
