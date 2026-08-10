import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...filesUnder(path));
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(path);
    }
  }
  return out;
}

/**
 * Every named import pulled from a module matching `regex`, with the file and
 * line that carried it, so a boundary assertion can name the offender.
 */
function namedImports(regex: RegExp): Array<{ file: string; line: string; names: string[] }> {
  const hits: Array<{ file: string; line: string; names: string[] }> = [];
  for (const file of filesUnder("src")) {
    for (const raw of readFileSync(file, "utf8").split("\n")) {
      if (!regex.test(raw)) continue;
      const m = raw.match(/\{([^}]*)\}/);
      const names = m
        ? m[1]
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => s.split(/\s+as\s+/)[0])
        : [];
      hits.push({ file, line: raw.trim(), names });
    }
  }
  return hits;
}

const DELETED_COMPONENTS = /from\s+["'][^"']*\/(avatar|label|textarea|dropdown-menu)["']/;
const HELPERS_MODULE = /from\s+["'][^"']*dao\/helpers["']/;
const OLD_AUDIT_DAO = /from\s+["'][^"']*dao\/audit\.dao["']/;

const DEAD_HELPERS = ["findById", "findByField", "exists", "deleteById"];

const KIOSK_OWNERS = new Set([
  "src/modules/kiosk/components/attendees-panel.tsx",
  "src/modules/kiosk/components/qr-scanner.tsx",
  "src/modules/kiosk/components/kiosk-scanner-view.tsx",
  "src/shared/integrations/realtime/index.ts",
]);
const KIOSK_TOKENS = /\b(attendees-panel|AttendeesPanel|qr-scanner|QrScanner|subscribeToCheckins)\b/;

describe("SPEC-14 dead code boundary", () => {
  it("never references the four deleted shared components", () => {
    expect(namedImports(DELETED_COMPONENTS)).toEqual([]);
  });

  it("never imports the deleted helpers exports", () => {
    const hits = namedImports(HELPERS_MODULE);
    // Sanity: the helpers module is still imported, so the dead-name check is
    // not passing on a module nobody uses.
    expect(hits.length).toBeGreaterThan(0);

    for (const hit of hits) {
      for (const name of DEAD_HELPERS) {
        expect(hit.names, `${name} referenced in ${hit.file}: ${hit.line}`).not.toContain(name);
      }
    }
  });

  it("keeps the audit read path inside the audit module", () => {
    // SPEC-11 moved writes to log-audit-event; the read DAO now lives with it.
    expect(namedImports(OLD_AUDIT_DAO)).toEqual([]);
  });

  it("keeps kiosk scanning code owned by the kiosk module", () => {
    const offenders: string[] = [];
    for (const file of filesUnder("src")) {
      const mentions = readFileSync(file, "utf8")
        .split("\n")
        .filter((line) => KIOSK_TOKENS.test(line));
      if (mentions.length > 0 && !KIOSK_OWNERS.has(file)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
