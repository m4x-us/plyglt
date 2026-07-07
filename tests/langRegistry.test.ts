import { describe, it, expect, vi, beforeEach } from "vitest";
import { LANGUAGE_REGISTRY, ALL_PACK_CODES, FREE_PACK_CODES, LANG_CONFIG_MAP, READY_PACK_CODES, isValidPackCode, SPECIALTY_PACKS, getSpecialtyPacks, isSpecialtyPackCode } from "@/lib/langRegistry";
import type { SpecialtyPack } from "@/lib/langRegistry";
import { ALL_KNOWN_PACKS } from "@/store/entitlementStore";

// ── Specialty pack mock ────────────────────────────────────────────────────────
// getSpecialtyPacks and isSpecialtyPackCode close over the module-internal SPECIALTY_PACKS
// constant — mocking only the export doesn't affect them. The mock factory re-implements
// both functions using mockSpecialtyPacks so the filter predicate is exercised against
// a live, mutable registry rather than the frozen empty constant.
const mockSpecialtyPacks = vi.hoisted<SpecialtyPack[]>(() => []);
vi.mock("@/lib/langRegistry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/langRegistry")>();
  return {
    ...actual,
    SPECIALTY_PACKS: mockSpecialtyPacks,
    getSpecialtyPacks: (lang: string): SpecialtyPack[] =>
      mockSpecialtyPacks.filter(sp => sp.baseLang === lang),
    isSpecialtyPackCode: (s: string): boolean =>
      mockSpecialtyPacks.some(sp => sp.code === s),
  };
});

// Reset to empty before every test so existing tests see the real empty-registry behaviour.
beforeEach(() => {
  mockSpecialtyPacks.length = 0;
});

describe("langRegistry — derived constants are consistent", () => {
  it("ALL_KNOWN_PACKS (from entitlementStore) equals ALL_PACK_CODES (from langRegistry)", () => {
    expect(new Set(ALL_KNOWN_PACKS)).toEqual(new Set(ALL_PACK_CODES));
  });

  it("LANG_CONFIG_MAP config.code matches the pack code for every entry", () => {
    // A bare existence check here would be redundant: if config were missing, config?.code
    // is undefined, and undefined !== code — the assertion below already fails in that case.
    for (const code of ALL_PACK_CODES) {
      const config = LANG_CONFIG_MAP[code];
      expect(config?.code, `LANG_CONFIG_MAP["${code}"] is missing or its .code does not match "${code}"`)
        .toBe(code);
    }
  });

  it("fr, de, pt are absent from LANG_CONFIG_MAP (removed stubs — no real packs)", () => {
    // These codes were removed from LANGUAGE_REGISTRY (2026-06-27) — they had placeholder
    // SPANISH configs. Re-add with real LanguageConfig objects when packs are ready.
    expect(LANG_CONFIG_MAP["fr"]).toBeUndefined();
    expect(LANG_CONFIG_MAP["de"]).toBeUndefined();
    expect(LANG_CONFIG_MAP["pt"]).toBeUndefined();
  });

  it("every free pack has isFree=true in the registry", () => {
    for (const code of FREE_PACK_CODES) {
      const entry = LANGUAGE_REGISTRY.find(l => l.code === code);
      expect(entry?.isFree).toBe(true);
    }
  });

  it("every ready language has an articles regex (not null)", () => {
    for (const entry of LANGUAGE_REGISTRY.filter(l => l.ready)) {
      expect(entry.config.articles).toBeInstanceOf(RegExp);
    }
  });

  it("no duplicate codes in the registry", () => {
    const codes = LANGUAGE_REGISTRY.map(l => l.code);
    expect(codes.length).toBe(new Set(codes).size);
  });

  it("every element of ALL_PACK_CODES is within the PackCode allowlist", () => {
    // Security guard: ALL_PACK_CODES backs the evictPack allowlist (isValidPackCode).
    // If a new registry entry slips in with an unexpected code, this catches it.
    const allowlist = new Set<string>(["it", "es"]);
    for (const code of ALL_PACK_CODES) {
      expect(allowlist.has(code), `unexpected code in allowlist: "${code}"`).toBe(true);
    }
    // Allowlist is complete — no valid PackCode is missing.
    expect(ALL_PACK_CODES.length).toBe(allowlist.size);
  });

  it("READY_PACK_CODES contains only entries with ready:true", () => {
    for (const code of READY_PACK_CODES) {
      const entry = LANGUAGE_REGISTRY.find(l => l.code === code);
      expect(entry?.ready, `${code} is in READY_PACK_CODES but ready:false`).toBe(true);
    }
  });

  it("Italian is the only free language", () => {
    expect(FREE_PACK_CODES).toContain("it");
    expect(FREE_PACK_CODES.filter(c => c !== "it").length).toBe(0);
  });
});

describe("SpecialtyPack registry — initial empty state", () => {
  it("SPECIALTY_PACKS is empty — no specialty content registered yet", () => {
    expect(SPECIALTY_PACKS.length).toBe(0);
  });

  it("getSpecialtyPacks returns empty array for any lang when registry is empty", () => {
    expect(getSpecialtyPacks("it")).toEqual([]);
    expect(getSpecialtyPacks("es")).toEqual([]);
    expect(getSpecialtyPacks("xx")).toEqual([]);
  });

  it("isSpecialtyPackCode returns false for base language codes", () => {
    // Base pack codes are in LANGUAGE_REGISTRY, not SPECIALTY_PACKS.
    expect(isSpecialtyPackCode("it")).toBe(false);
    expect(isSpecialtyPackCode("es")).toBe(false);
  });

  it("isSpecialtyPackCode returns false for unregistered specialty-format codes", () => {
    expect(isSpecialtyPackCode("it-medical")).toBe(false);
    expect(isSpecialtyPackCode("it-business")).toBe(false);
    expect(isSpecialtyPackCode("es-cooking")).toBe(false);
  });

  it("isSpecialtyPackCode returns false for path traversal attempts", () => {
    expect(isSpecialtyPackCode("../evil")).toBe(false);
    expect(isSpecialtyPackCode("../../etc/passwd")).toBe(false);
  });
});

describe("isValidPackCode — type guard", () => {
  it("returns true for registered codes", () => {
    expect(isValidPackCode("it")).toBe(true);
    expect(isValidPackCode("es")).toBe(true);
  });

  it("returns false for unregistered codes", () => {
    expect(isValidPackCode("xx")).toBe(false);
    expect(isValidPackCode("fr")).toBe(false);
    expect(isValidPackCode("de")).toBe(false);
    expect(isValidPackCode("pt")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isValidPackCode("")).toBe(false);
  });

  it("returns false for path traversal attempts", () => {
    expect(isValidPackCode("../evil")).toBe(false);
    expect(isValidPackCode("../../etc/passwd")).toBe(false);
  });
});

describe("getSpecialtyPacks with non-empty registry", () => {
  beforeEach(() => {
    mockSpecialtyPacks.push(
      { code: "it-medical", baseLang: "it", name: "Medical", ready: false },
      { code: "it-business", baseLang: "it", name: "Business", ready: false },
      { code: "es-travel", baseLang: "es", name: "Travel", ready: false },
    );
  });

  it("returns only Italian packs for \"it\"", () => {
    expect(getSpecialtyPacks("it")).toHaveLength(2);
  });

  it("returns only Spanish packs for \"es\"", () => {
    expect(getSpecialtyPacks("es")).toHaveLength(1);
  });

  it("returns [] for unknown language \"fr\"", () => {
    expect(getSpecialtyPacks("fr")).toEqual([]);
  });
});
