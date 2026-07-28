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
      // Task #473: "scripts" was previously excluded wholesale — this hid
      // scripts/validatePack.ts's substantial validator logic (Task #459's prerequisites
      // and unitCount/cardCount cross-checks) from the Verification Gate's coverage
      // percentages, even though tests/validatePack.test.ts already exercises it directly
      // (validatePack.ts guards its CLI section behind an isMainModule check specifically
      // so its exported functions are safely importable in tests). Narrowed the exclude to
      // only the two scripts that are genuinely unsafe to import in a test process:
      // scripts/exportPack.ts and scripts/checkCardIds.ts both run unconditional top-level
      // side effects (file writes, process.argv reads, process.exit()) with no
      // isMainModule guard and no exported pure functions — importing either would
      // execute real file I/O and kill the test worker via process.exit(), not just fail
      // a test. Giving them dedicated tests would require extracting their logic behind a
      // guard first (the same refactor validatePack.ts already has) — out of this task's
      // single-file scope; logged as follow-up work if their coverage is ever needed.
      exclude: ["node_modules", "tests", ".next", "scripts/exportPack.ts", "scripts/checkCardIds.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
