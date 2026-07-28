// ============================================================
// tests/validatePack.test.ts — regression coverage for scripts/validatePack.ts
// ============================================================
// Task #459 (F5): scripts/validatePack.ts's own header mandates staying in sync with
// lib/packTypes.ts's hasValidUnitsArray — the CI-time schema check and the runtime shape
// guard must reject the same malformed packs. Two divergences confirmed across two
// consecutive audit cycles (both closed by this file):
//   1. card.prerequisites had no validateCard counterpart — a pack with
//      prerequisites: "c0" (a truthy non-array) passed CI and only crashed at runtime via
//      lib/srs.ts's unguarded `.every()`.
//   2. unitCount/cardCount had no cross-check against the real array lengths in
//      validatePack — a declared count could silently diverge from reality.
// ============================================================

import { describe, it, expect } from "vitest";
import { validateCard, validateUnit, validatePack } from "@/scripts/validatePack";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeValidCard(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "it-a1u01-001",
    type: "produce",
    prompt: "hello",
    accepted: ["ciao"],
    tags: ["greetings"],
    tier: 1,
    ...overrides,
  };
}

function makeValidUnit(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "a1-u01",
    name: "Greetings",
    level: "A1",
    theme: "Greetings & Introductions",
    emoji: "👋",
    prerequisiteUnits: [],
    cards: [makeValidCard()],
    ...overrides,
  };
}

function makeValidPack(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const units = (overrides.units as unknown[] | undefined) ?? [makeValidUnit()];
  const totalCards = units.reduce((sum: number, u) => {
    const unit = u as Record<string, unknown>;
    return sum + (Array.isArray(unit.cards) ? unit.cards.length : 0);
  }, 0);
  return {
    _version: 1,
    lang: "it",
    packVersion: "1.0.0",
    canonicalSource: "en",
    unitCount: units.length,
    cardCount: totalCards,
    units,
    ...overrides,
  };
}

// ── validateCard: prerequisites gap (F5, divergence 1) ────────────────────────

describe("validateCard — prerequisites (mirrors lib/packTypes.ts's hasValidUnitsArray)", () => {
  it("accepts a card with no prerequisites field at all (optional field, undefined is valid)", () => {
    const errors = validateCard(makeValidCard(), "card");
    expect(errors).toEqual([]);
  });

  it("accepts a card whose prerequisites is a valid array of strings", () => {
    const errors = validateCard(makeValidCard({ prerequisites: ["it-a1u01-001", "it-a1u01-002"] }), "card");
    expect(errors).toEqual([]);
  });

  it("rejects a card whose prerequisites is a truthy non-array string (the exact F5 regression case)", () => {
    // "c0" has a truthy .length, so a naive `?.length` check (lib/srs.ts's own guard) would
    // pass it through — hasValidUnitsArray requires Array.isArray explicitly, and so must
    // this validator, to catch the exact pack that crashes lib/srs.ts's unguarded .every().
    const errors = validateCard(makeValidCard({ prerequisites: "c0" }), "card");
    expect(errors).toEqual(["card.prerequisites: when present, must be an array of strings"]);
  });

  it("rejects a card whose prerequisites array contains a non-string element", () => {
    const errors = validateCard(makeValidCard({ prerequisites: ["it-a1u01-001", 42] }), "card");
    expect(errors).toEqual(["card.prerequisites: when present, must be an array of strings"]);
  });

  it("rejects a card whose prerequisites is null (undefined is the only valid absence, not null)", () => {
    const errors = validateCard(makeValidCard({ prerequisites: null }), "card");
    expect(errors).toEqual(["card.prerequisites: when present, must be an array of strings"]);
  });
});

// ── validatePack: unitCount/cardCount cross-check (F5, divergence 2) ──────────

describe("validatePack — unitCount/cardCount cross-check (mirrors hasValidUnitsArray)", () => {
  it("accepts a pack whose declared unitCount/cardCount match the real array lengths", () => {
    const errors = validatePack(makeValidPack());
    expect(errors).toEqual([]);
  });

  it("rejects a pack whose declared unitCount does not match units.length", () => {
    const pack = makeValidPack({ unitCount: 5 });
    const errors = validatePack(pack);
    expect(errors).toContain("Pack.unitCount: declared 5 does not match actual units.length 1");
  });

  it("rejects a pack whose declared cardCount does not match the real total card count", () => {
    const pack = makeValidPack({ cardCount: 99 });
    const errors = validatePack(pack);
    expect(errors).toContain("Pack.cardCount: declared 99 does not match actual total cards 1");
  });

  it("rejects a pack whose unitCount is not a number at all", () => {
    const pack = makeValidPack({ unitCount: "1" });
    const errors = validatePack(pack);
    expect(errors).toContain("Pack.unitCount: must be a number");
  });

  it("rejects a pack whose cardCount is not a number at all", () => {
    const pack = makeValidPack({ cardCount: "1" });
    const errors = validatePack(pack);
    expect(errors).toContain("Pack.cardCount: must be a number");
  });

  it("correctly sums cards across multiple units for the cardCount check", () => {
    const units = [
      makeValidUnit({ id: "u1", cards: [makeValidCard({ id: "c1" }), makeValidCard({ id: "c2" })] }),
      makeValidUnit({ id: "u2", cards: [makeValidCard({ id: "c3" })] }),
    ];
    const errors = validatePack(makeValidPack({ units, unitCount: 2, cardCount: 3 }));
    expect(errors).toEqual([]);
  });

  it("a fully valid pack (both checks + existing schema checks) passes with zero errors", () => {
    expect(validatePack(makeValidPack())).toEqual([]);
  });
});

// ── validateUnit: sanity that the exported function still works standalone ───

describe("validateUnit — sanity (unchanged by this task, exported for direct testing)", () => {
  it("accepts a well-formed unit", () => {
    expect(validateUnit(makeValidUnit(), "unit")).toEqual([]);
  });

  it("rejects a unit with an invalid level", () => {
    const errors = validateUnit(makeValidUnit({ level: "C1" }), "unit");
    expect(errors).toContain('unit.level: invalid "C1" — must be A1, A2, B1, or B2');
  });
});
