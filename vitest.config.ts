import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    passWithNoTests: true,
    // Exclude worktrees created by build agents — they contain stale test
    // file copies that would otherwise be discovered and run against the
    // current codebase with mismatched assertions.
    exclude: ["node_modules", ".claude/**", "tests/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      // Thresholds ratcheted after Wave 1 new tests (2026-06-26: stmts=85.87%, branches=82.46%,
      // funcs=84.35%, lines=87.54%). Set at safe floor ~3% below actual — thresholds only
      // ever increase. Low branch/function numbers are driven by components/ and hooks/
      // which use React APIs unavailable in the node test environment.
      thresholds: {
        lines: 84,
        functions: 79,
        branches: 81,
        statements: 82,
      },
      exclude: ["node_modules", "tests", ".next", "scripts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
