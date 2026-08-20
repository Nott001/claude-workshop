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
      // Raised with the shared `badRequest` helper: the 23 routes that each
      // rendered a Zod error inline now share one covered branch. Lower these
      // only for a denominator effect — covered code being deleted raises the
      // untouched remainder's share — and never to make a build pass.
      //
      // Statements and lines are down 0.01 for exactly that reason: the four
      // `return { success: true }` lines the delete and publish services carried
      // were covered, and dropping them took four from both halves of the ratio.
      // No test stopped covering anything.
      //
      // Raised again with the after-event module release: its gate, settings
      // store, release rule and both new surfaces arrived covered, so the
      // ratchet moves up to what they measure rather than sitting where the
      // feature found it.
      //
      // And again with event photos. The archive arrived with its DAO, its
      // service authz, both routes, the gallery and the staff manager under
      // test, and the two storage-cleanup bugs it exposed are now held by
      // tests of their own — so every part moves up rather than diluting.
      thresholds: {
        statements: 83.84,
        branches: 78.65,
        functions: 82.71,
        lines: 85.05,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
