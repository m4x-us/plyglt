// ============================================================
// tests/checkCardIds.test.ts — regression coverage for scripts/checkCardIds.ts
// ============================================================
// scripts/checkCardIds.ts is a CLI script (reads process.argv, calls process.exit) with no
// pre-existing tests — its executable body is guarded by `if (isMainModule)` (multi-language
// architecture prep, same pattern as scripts/lintCardQuality.ts) specifically so this file can
// safely import it without triggering that CLI logic. Only the new, pure ID-prefix check
// (findPrefixViolations) is unit-tested here; the removed/added-ID diff logic and file I/O
// remain covered by manual CLI verification only, matching this script's pre-existing state.

import { describe, it, expect } from "vitest";
import { findPrefixViolations } from "@/scripts/checkCardIds";

describe("findPrefixViolations", () => {
  it("flags a newly-added non-Italian card ID that doesn't start with '{lang}-'", () => {
    // B7 target: deleting the `if (lang === "it") return [];` early-return's inverse logic
    // (i.e. the actual prefix check) would make this test fail — a legacy-format ID from a
    // Spanish pack would silently pass instead of being flagged.
    expect(findPrefixViolations("es", ["u99-t1-999"])).toEqual(["u99-t1-999"]);
  });

  it("does not flag a correctly-namespaced card ID", () => {
    expect(findPrefixViolations("es", ["es-a1u01-t1-001"])).toEqual([]);
  });

  it("exempts Italian entirely, even for a legacy-format ID", () => {
    // Italian's IDs are deliberately frozen in the legacy unnamespaced format
    // (content/index.ts:3-5) — migrating them risks corrupting live user FSRS progress.
    expect(findPrefixViolations("it", ["u01-t1-001"])).toEqual([]);
  });

  it("only flags the specific violating IDs, not every added ID", () => {
    const result = findPrefixViolations("es", ["es-a1u01-t1-001", "u99-t1-999", "es-a1u01-t1-002"]);
    expect(result).toEqual(["u99-t1-999"]);
  });

  it("returns an empty array when nothing was added", () => {
    expect(findPrefixViolations("es", [])).toEqual([]);
  });

  it("does not flag an ID that merely contains the language code, not as a prefix", () => {
    // "a1u01-es-t1-001" contains "es" but does not START with "es-" — must still be flagged.
    expect(findPrefixViolations("es", ["a1u01-es-t1-001"])).toEqual(["a1u01-es-t1-001"]);
  });
});
