import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["test/**/*.{test,spec}.{ts,tsx}"],
    // Playwright specs live under test/e2e and share the .spec.ts suffix. They
    // need a browser and a live database, so vitest must not try to run them —
    // `pnpm test` stays a fast hermetic run. Playwright owns that directory.
    exclude: [...configDefaults.exclude, "test/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov", "json-summary"],
      reportsDirectory: "coverage",
      include: ["src/**/*.{ts,tsx}"],
      // Type-only and view-composition files carry no branching logic worth gating on.
      // Excluded here rather than in the coverage `include` so they still appear in
      // reports but cannot fail the ratchet.
      exclude: ["src/**/*.d.ts", "src/shared/types.ts", "src/app/**/layout.tsx", "src/app/**/page.tsx", "src/app/globals.css"],
      // Ratchet, not a goal. Set at the measured baseline so coverage cannot
      // regress; raise these as the API-route and DAO gaps close.
      //
      // These read a hair under the previous baseline, which is a denominator
      // effect rather than a regression: the settings refactor deleted fully
      // covered code (its own page component, and the section nav that
      // replaced it briefly), and removing covered code from a codebase at 81%
      // raises the untouched remainder's share. Uncovered statements did not
      // move across the whole change — 1485 before and after. Only re-baseline
      // for a reason like that; never to make a build pass.
      thresholds: {
        statements: 81.81,
        branches: 76.54,
        functions: 81.08,
        lines: 82.89,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
