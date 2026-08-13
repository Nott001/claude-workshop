import { execSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = join(ROOT, ".env.local");
const REMOTE_PATH = join(ROOT, ".env.remote");

const REWRITE_KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];

const USAGE = "Usage: node scripts/db-env.mjs <local|remote>";

function readEnv(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function atomicWrite(path, contents) {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, contents);
  renameSync(tmp, path);
}

function fetchLocalValues() {
  const out = execSync("supabase status -o env", { cwd: ROOT, encoding: "utf8" });
  const values = {};
  for (const line of out.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)="?([^"\n]*)"?$/);
    if (match) values[match[1]] = match[2];
  }
  for (const key of ["API_URL", "ANON_KEY", "SERVICE_ROLE_KEY"]) {
    if (!values[key]) throw new Error(`local Supabase did not report ${key} — is the stack running?`);
  }
  return {
    NEXT_PUBLIC_SUPABASE_URL: values.API_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: values.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: values.SERVICE_ROLE_KEY,
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  };
}

function rewrite(current, values) {
  const lines = current.split("\n");
  let replaced = 0;
  const next = lines.map((line) => {
    const key = Object.keys(values).find((k) => line.startsWith(`${k}=`));
    if (!key) return line;
    replaced += 1;
    return `${key}=${values[key]}`;
  });
  if (replaced < REWRITE_KEYS.length + (values.NEXT_PUBLIC_APP_URL ? 1 : 0)) {
    throw new Error(
      `expected to rewrite ${REWRITE_KEYS.length + 1} lines but matched ${replaced} — .env.local may be malformed`,
    );
  }
  return next.join("\n");
}

function reportDiff(before, after, label) {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const max = Math.max(beforeLines.length, afterLines.length);
  const changed = [];
  for (let i = 0; i < max; i += 1) {
    if (beforeLines[i] !== afterLines[i]) changed.push({ line: i + 1, before: beforeLines[i], after: afterLines[i] });
  }
  console.log(`${label}:`);
  if (changed.length === 0) {
    console.log("  no line changed (already in this mode)");
    return;
  }
  for (const { line, before, after } of changed) {
    const mask = (v) => (/^[A-Z0-9_]+=/.test(v) ? `${v.slice(0, 18)}…<redacted>` : v);
    console.log(`  L${line}: ${mask(before)}  →  ${mask(after)}`);
  }
}

const mode = process.argv[2];

if (mode === "local") {
  const current = readEnv(ENV_PATH);
  if (!existsSync(REMOTE_PATH)) {
    atomicWrite(REMOTE_PATH, current);
    console.log("Saved current .env.local to .env.remote for later restore.");
  }
  const local = fetchLocalValues();
  const before = readEnv(ENV_PATH);
  const after = rewrite(before, local);
  atomicWrite(ENV_PATH, after);
  reportDiff(before, after, "local");
} else if (mode === "remote") {
  if (!existsSync(REMOTE_PATH)) {
    console.error("No .env.remote snapshot to restore from. Run `pnpm db:env local` first.");
    process.exit(1);
  }
  const restored = readFileSync(REMOTE_PATH, "utf8");
  const before = readEnv(ENV_PATH);
  atomicWrite(ENV_PATH, restored);
  reportDiff(before, restored, "remote");
} else {
  console.error(USAGE);
  process.exit(1);
}
