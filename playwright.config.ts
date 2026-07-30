import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// Locally the credentials live in .env.local; in CI they arrive as secrets on
// the environment already. Node's own loader avoids a dotenv dependency.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

const PORT = Number(process.env.E2E_PORT ?? 3200);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  // Under test/ per AGENTS.md, in its own directory that vitest excludes: these
  // need a browser and a live database, so `pnpm test` must not pick them up.
  testDir: "./test/e2e",
  outputDir: "./test/e2e/.results",

  // Each spec provisions its own users and event, so parallelism is safe. On CI
  // a single worker keeps output readable and load predictable.
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined,

  // A retry masks a real flake locally, where it should be diagnosed. On CI one
  // retry absorbs genuine network noise without hiding a reproducible failure.
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,

  // Everything a run produces stays inside test/e2e, next to the specs that
  // produced it, rather than scattering directories across the repository root.
  reporter: process.env.CI ? [["github"], ["html", { open: "never", outputFolder: "test/e2e/.report" }]] : [["list"]],

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    // Builds first so `pnpm test:e2e` works from a clean checkout instead of
    // failing on a missing .next. Rebuilds are incremental against .next/cache,
    // which both this and the CI build job share. A dedicated port keeps a dev
    // server on 3000 out of the way.
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
