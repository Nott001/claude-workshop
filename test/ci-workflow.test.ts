import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The E2E workflow has to agree with playwright.config.ts about where a report
 * is written and when a run may be cancelled. Nothing else enforces that: the
 * workflow uploaded a directory Playwright never wrote for as long as it
 * existed, and the mismatch was invisible because an empty upload does not fail.
 */
const workflow = readFileSync(".github/workflows/e2e.yml", "utf8");

/** The `path:` of the step that uploads the Playwright report. */
function uploadPath(): string {
  const step = workflow.split("name: Upload report")[1];
  return step?.match(/^\s*path:\s*(\S+)/m)?.[1] ?? "";
}

/**
 * Resolved the way CI resolves it: the html reporter is only selected when CI
 * is set, so asking the config outside that branch answers a question the
 * workflow never asks.
 */
async function htmlReporterOutputFolder(): Promise<string> {
  const previous = process.env.CI;
  process.env.CI = "true";
  try {
    const { default: config } = await import("../playwright.config");
    const reporters = config.reporter;
    if (!Array.isArray(reporters)) throw new Error("expected the CI reporter array");
    const html = reporters.find((r) => Array.isArray(r) && r[0] === "html") as [string, { outputFolder: string }];
    if (!html) throw new Error("expected an html reporter under CI");
    return html[1].outputFolder;
  } finally {
    process.env.CI = previous;
  }
}

describe("E2E workflow and Playwright config agree", () => {
  it("uploads the directory the html reporter actually writes to", async () => {
    expect(uploadPath().replace(/\/$/, "")).toBe(await htmlReporterOutputFolder());
  });

  it("uploads a report even when the run failed", () => {
    // The report is only interesting on failure, so the step cannot be skipped.
    expect(workflow).toMatch(/name: Upload report\s*\n\s*if: always\(\)/);
  });
});

describe("E2E concurrency", () => {
  it("does not cancel a run on main", () => {
    // A push run is the only verification that merge gets, and cancelling it
    // mid-flight also strands the rows the fixtures were about to delete.
    const cancel = workflow.match(/cancel-in-progress:\s*(.+)/)?.[1].trim();
    expect(cancel).not.toBe("true");
    expect(cancel).toContain("pull_request");
  });
});
