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

// ── validatePack: duplicate-card-ID loop must not throw on malformed cards (F468) ──

describe("validatePack — duplicate card-ID check tolerates malformed cards fields (#468)", () => {
  it("returns a normal error array (not an uncaught exception) when a unit's cards field is null", () => {
    // Before #468, this loop cast `unit["cards"]` straight to Json[] with no isArray guard
    // (unlike validateUnit's own check) — cards: null threw an uncaught TypeError instead
    // of returning validatePack's own `(raw): string[]` contract, crashing the CI validator
    // process (npm run pack:validate:all) on exactly the malformed input it exists to catch.
    const pack = makeValidPack({ units: [makeValidUnit({ cards: null })], unitCount: 1, cardCount: 0 });
    expect(() => validatePack(pack)).not.toThrow();
    const errors = validatePack(pack);
    expect(errors).toContain("units[0].cards: must be a non-empty array");
  });

  it("tolerates a unit's cards field being a non-array, non-null value (number)", () => {
    // Task #476 (C8-F03): a STRING fixture here ("not-an-array") does not actually exercise
    // the isArray guard's throw path — strings are iterable via for...of (yielding
    // characters) and never throw, so this test passed identically whether or not the
    // guard existed (confirmed by mutation testing). A number is not iterable at all —
    // `for (const card of (42 as Json[]))` throws TypeError without the guard, making this
    // fixture genuinely discriminating.
    const pack = makeValidPack({ units: [makeValidUnit({ cards: 42 })], unitCount: 1, cardCount: 0 });
    expect(() => validatePack(pack)).not.toThrow();
  });

  it("tolerates a non-object unit inside the units array (e.g. null)", () => {
    // Built directly (not via makeValidPack) — that helper's own totalCards computation
    // assumes well-formed units, which is exactly what this test deliberately violates.
    const pack = {
      _version: 1, lang: "it", packVersion: "1.0.0", canonicalSource: "en",
      unitCount: 1, cardCount: 0, units: [null],
    };
    expect(() => validatePack(pack)).not.toThrow();
  });

  it("tolerates a non-array units field on the pack itself (plain object)", () => {
    // Task #476 (C8-F03): same non-discrimination issue as the "cards" test above — a
    // STRING fixture ("not-an-array") is iterable via for...of and never throws, so it
    // never exercised the dedup loop's `isArray(raw["units"])` guard's throw path. A plain
    // object has no Symbol.iterator — `for (const unit of ({} as Json[]))` throws TypeError
    // without the guard, making this fixture genuinely discriminating.
    const pack = {
      _version: 1, lang: "it", packVersion: "1.0.0", canonicalSource: "en",
      unitCount: 0, cardCount: 0, units: {},
    };
    expect(() => validatePack(pack)).not.toThrow();
  });

  it("tolerates a non-object card element inside an otherwise-valid cards array", () => {
    const pack = makeValidPack({ units: [makeValidUnit({ cards: [null] })], unitCount: 1, cardCount: 1 });
    expect(() => validatePack(pack)).not.toThrow();
  });

  it("still detects real duplicate card IDs across units after the guard is added", () => {
    const units = [
      makeValidUnit({ id: "u1", cards: [makeValidCard({ id: "dupe" })] }),
      makeValidUnit({ id: "u2", cards: [makeValidCard({ id: "dupe" })] }),
    ];
    const errors = validatePack(makeValidPack({ units, unitCount: 2, cardCount: 2 }));
    expect(errors).toContain("Duplicate card IDs: dupe");
  });

  // Task #478 (C8-F05): two cards both missing/with a non-string id must not collide as
  // the same dedup key — before the fix, `card["id"] as string` cast both `undefined`s
  // to the literal string "undefined" (via ids.has/add on the raw unchecked value),
  // producing a garbled "Duplicate card IDs: " line with nothing readable after the colon.
  //
  // Task #480 F010: these tests (and the two new ones below) assert BOTH that the garbled
  // duplicate line is absent AND that validateCard's own per-card id errors are still
  // present — absence-only assertions can't distinguish "correctly suppressed" from
  // "the dedup loop silently stopped running/being reached at all", which would also make
  // the garbled-line assertion pass for the wrong reason.
  it("does not report a garbled 'Duplicate card IDs:' line for two cards both missing an id, and still reports each card's own id error", () => {
    const units = [
      makeValidUnit({
        id: "u1",
        cards: [makeValidCard({ id: undefined }), makeValidCard({ id: undefined })],
      }),
    ];
    const errors = validatePack(makeValidPack({ units, unitCount: 1, cardCount: 2 }));
    expect(errors.some((e) => e.startsWith("Duplicate card IDs:"))).toBe(false);
    expect(errors).toContain("units[0].cards[0].id: missing or empty string");
    expect(errors).toContain("units[0].cards[1].id: missing or empty string");
  });

  it("does not report a garbled 'Duplicate card IDs:' line for two cards both with a non-string id, and still reports each card's own id error", () => {
    const units = [
      makeValidUnit({
        id: "u1",
        cards: [makeValidCard({ id: 42 }), makeValidCard({ id: 42 })],
      }),
    ];
    const errors = validatePack(makeValidPack({ units, unitCount: 1, cardCount: 2 }));
    expect(errors.some((e) => e.startsWith("Duplicate card IDs:"))).toBe(false);
    expect(errors).toContain("units[0].cards[0].id: missing or empty string");
    expect(errors).toContain("units[0].cards[1].id: missing or empty string");
  });

  // Task #480 (F002): #478's fix (`!isString(id)`) closed the non-string case but missed
  // that two cards both with id:"" (or id:" ", whitespace-only) both pass isString() —
  // "" and " " are strings — and so still collide in the ids Set, reproducing the exact
  // same garbled "Duplicate card IDs: " line #478 was supposed to eliminate entirely.
  it("does not report a garbled 'Duplicate card IDs:' line for two cards both with an empty-string id, and still reports each card's own id error", () => {
    const units = [
      makeValidUnit({
        id: "u1",
        cards: [makeValidCard({ id: "" }), makeValidCard({ id: "" })],
      }),
    ];
    const errors = validatePack(makeValidPack({ units, unitCount: 1, cardCount: 2 }));
    expect(errors.some((e) => e.startsWith("Duplicate card IDs:"))).toBe(false);
    expect(errors).toContain("units[0].cards[0].id: missing or empty string");
    expect(errors).toContain("units[0].cards[1].id: missing or empty string");
  });

  it("does not report a garbled 'Duplicate card IDs:' line for two cards both with a whitespace-only id, and still reports each card's own id error", () => {
    const units = [
      makeValidUnit({
        id: "u1",
        cards: [makeValidCard({ id: " " }), makeValidCard({ id: " " })],
      }),
    ];
    const errors = validatePack(makeValidPack({ units, unitCount: 1, cardCount: 2 }));
    expect(errors.some((e) => e.startsWith("Duplicate card IDs:"))).toBe(false);
    expect(errors).toContain("units[0].cards[0].id: missing or empty string");
    expect(errors).toContain("units[0].cards[1].id: missing or empty string");
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
