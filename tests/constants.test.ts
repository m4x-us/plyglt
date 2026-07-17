// === tests/constants.test.ts ===
// Tests for lib/constants.ts — the sole authorized localStorage accessor for LANG_PAIR_KEY.
// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from "vitest";
import { LANG_PAIR_KEY, getTargetLangCode, getLangPair, hasStoredLangPair, setTargetLangCode } from "@/lib/constants";

describe("hasStoredLangPair (#389)", () => {
  beforeEach(() => { localStorage.clear(); });

  it("returns false when nothing is stored — even though the getters synthesize defaults", () => {
    expect(hasStoredLangPair()).toBe(false);
    // The distinction this function exists for: presence vs synthesized default.
    expect(getLangPair()).toBe("en-it");
    expect(getTargetLangCode()).toBe("it");
  });

  it("returns true after setTargetLangCode stores a pair", () => {
    setTargetLangCode("it");
    expect(hasStoredLangPair()).toBe(true);
    expect(localStorage.getItem(LANG_PAIR_KEY)).toBe("en-it");
  });
});
