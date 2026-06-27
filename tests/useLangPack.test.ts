// === tests/useLangPack.test.ts ===
// Tests for hooks/useLangPack.ts — stability invariants and source-level guards.
// Note: React hook rendering requires jsdom; this file uses source assertions and
// pure function tests runnable in the node environment.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getLanguageConfig } from "@/lib/language";

const hookSrc = readFileSync(
  path.resolve(__dirname, "../hooks/useLangPack.ts"),
  "utf8"
);

// ── getLanguageConfig referential stability ────────────────────────────────────
// useLangPack passes `lang` into a useEffect dep array. If getLanguageConfig
// returns a new object on every call, the effect fires every render → infinite loop.

describe("getLanguageConfig — referential stability", () => {
  it("returns the same object reference for 'it' on repeated calls", () => {
    expect(getLanguageConfig("it")).toBe(getLanguageConfig("it"));
  });

  it("returns the same reference for all five pack codes", () => {
    const codes = ["it", "es", "fr", "de", "pt"] as const;
    for (const code of codes) {
      expect(getLanguageConfig(code)).toBe(getLanguageConfig(code));
    }
  });

  it("returns a defined LanguageConfig for every known pack code", () => {
    const codes = ["it", "es", "fr", "de", "pt"] as const;
    for (const code of codes) {
      const cfg = getLanguageConfig(code);
      expect(cfg).toBeDefined();
      expect(typeof cfg.code).toBe("string");
      expect(cfg.code.length).toBeGreaterThan(0);
    }
  });
});

// ── useLangPack source guards ─────────────────────────────────────────────────
// Regression guards: prevent the unstable-lang-ref bug from being reintroduced.
// These tests fail if the memoization is removed.

describe("useLangPack.ts — source-level stability guards", () => {
  it("uses useMemo to stabilize lang before placing it in useEffect deps", () => {
    // Without useMemo, `lang` is a new object on every render — unstable dep.
    expect(hookSrc).toContain("useMemo");
  });

  it("imports useMemo from react", () => {
    expect(hookSrc).toMatch(/import\s+\{[^}]*useMemo[^}]*\}\s+from\s+["']react["']/);
  });

  it("lang is derived inside useMemo(() => getLanguageConfig(targetLang))", () => {
    // Guards against inlining getLanguageConfig() directly in the dep array
    // or computing it without memoization.
    expect(hookSrc).toContain("useMemo(() => getLanguageConfig(targetLang)");
  });
});

// ── invalid_lang seam test (A002 — Task #060, updated by Task #069) ─────────
// Rule 13 seam: verifies that error discriminants from LoadPackResult are
// translated through LOAD_PACK_ERROR_MESSAGES before reaching LangPackState.error.

describe("useLangPack.ts — invalid_lang seam (A002, updated #069)", () => {
  it("translates result.error through LOAD_PACK_ERROR_MESSAGES before storing in state", () => {
    // Task #069: raw discriminants must NOT reach state.error directly.
    // Translation happens at the hook boundary via LOAD_PACK_ERROR_MESSAGES.
    expect(hookSrc).toContain("LOAD_PACK_ERROR_MESSAGES[result.error]");
  });

  it("catch block uses translated message — not the raw discriminant string", () => {
    // The catch path falls back through the map so users never see "download_failed".
    expect(hookSrc).not.toContain('error: "download_failed"');
  });
});

// ── LOAD_PACK_ERROR_MESSAGES — BRAND.md compliance (Task #069) ───────────────
// Tests the translation map exported from hooks/useLangPack.ts directly.
// No jsdom needed — the map is a plain object, not a hook.

import { LOAD_PACK_ERROR_MESSAGES } from "@/hooks/useLangPack";

const RAW_DISCRIMINANTS = [
  "invalid_lang",
  "download_failed",
  "checksum_mismatch",
  "parse_error",
] as const;

const FILLER_WORDS = ["just", "simply", "quickly", "easily"];

describe("LOAD_PACK_ERROR_MESSAGES — BRAND.md compliant translations (Task #069)", () => {
  for (const discriminant of RAW_DISCRIMINANTS) {
    describe(discriminant, () => {
      it("translated message is not the raw discriminant", () => {
        expect(LOAD_PACK_ERROR_MESSAGES[discriminant]).not.toBe(discriminant);
      });

      it("translated message is a non-empty string", () => {
        expect(typeof LOAD_PACK_ERROR_MESSAGES[discriminant]).toBe("string");
        expect(LOAD_PACK_ERROR_MESSAGES[discriminant].length).toBeGreaterThan(0);
      });

      it("translated message contains no exclamation mark", () => {
        expect(LOAD_PACK_ERROR_MESSAGES[discriminant]).not.toContain("!");
      });

      it("translated message contains no filler words", () => {
        const msg = LOAD_PACK_ERROR_MESSAGES[discriminant].toLowerCase();
        for (const filler of FILLER_WORDS) {
          expect(msg).not.toContain(filler);
        }
      });
    });
  }
});

// ── @deprecated re-export guard (Task #057) ───────────────────────────────────

describe("useLangPack.ts — @deprecated re-export (Task #057)", () => {
  it("re-export of LANG_PAIR_KEY is still present (backwards compat preserved)", () => {
    expect(hookSrc).toContain("export { LANG_PAIR_KEY");
  });

  it("re-export block carries @deprecated JSDoc annotation", () => {
    expect(hookSrc).toContain("@deprecated");
  });
});
