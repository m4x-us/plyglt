import { describe, it, expect } from "vitest";
import { LANGUAGE_REGISTRY, ALL_PACK_CODES, FREE_PACK_CODES, LANG_CONFIG_MAP, READY_PACK_CODES, isValidPackCode } from "@/lib/langRegistry";
import { ALL_KNOWN_PACKS } from "@/store/entitlementStore";

describe("langRegistry — derived constants are consistent", () => {
  it("ALL_KNOWN_PACKS (from entitlementStore) equals ALL_PACK_CODES (from langRegistry)", () => {
    expect(new Set(ALL_KNOWN_PACKS)).toEqual(new Set(ALL_PACK_CODES));
  });

  it("LANG_CONFIG_MAP config.code matches the pack code for every entry", () => {
    for (const code of ALL_PACK_CODES) {
      const config = LANG_CONFIG_MAP[code];
      expect(config, `no config for "${code}"`).toBeDefined();
      if (!config) return;
      expect(config.code, `LANG_CONFIG_MAP["${code}"].code is "${config.code}" — expected "${code}"`)
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
