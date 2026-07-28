// === tests/constants.test.ts ===
// Tests for lib/constants.ts — the sole authorized localStorage accessor for LANG_PAIR_KEY.
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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

describe("localStorage error handling (#434)", () => {
  let saved: PropertyDescriptor | undefined;
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    saved = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: () => { throw new Error("quota exceeded"); },
        setItem: () => { throw new Error("quota exceeded"); },
        removeItem: () => { throw new Error("quota exceeded"); },
      },
      configurable: true,
      writable: true,
    });
    errorSpy.mockClear();
  });

  afterEach(() => {
    if (saved) Object.defineProperty(window, "localStorage", saved);
  });

  it("getTargetLangCode falls back to \"it\" and logs instead of throwing", () => {
    expect(getTargetLangCode()).toBe("it");
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("ERR-CONST-GET-TARGET-LANG"));
  });

  it("setTargetLangCode swallows the throw and logs instead of crashing the caller", () => {
    expect(() => setTargetLangCode("es")).not.toThrow();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("ERR-CONST-SET-TARGET-LANG"));
  });

  it("getLangPair falls back to \"en-it\" and logs instead of throwing", () => {
    expect(getLangPair()).toBe("en-it");
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("ERR-CONST-GET-LANG-PAIR"));
  });

  it("hasStoredLangPair falls back to false and logs instead of throwing", () => {
    expect(hasStoredLangPair()).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("ERR-CONST-HAS-LANG-PAIR"));
  });
});
