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
      thresholds: {
        statements: 33.81,
        branches: 30.27,
        functions: 34.33,
        lines: 34.11,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
