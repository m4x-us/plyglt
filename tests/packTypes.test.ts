import { describe, it, expect } from "vitest";
import { hasValidUnitsArray } from "@/lib/packTypes";
import type { Pack } from "@/lib/packTypes";

// Task #418: unitCount/cardCount default to the ACTUAL units.length / summed cards.length
// of the given `units` override, not a hardcoded 0/0 — a genuine pack's declared counts
// always match its real array lengths, and hasValidUnitsArray now cross-checks that. Every
// existing "returns true" test in this file relies on this auto-computation to keep passing
// unchanged; only the explicit mismatch tests below override unitCount/cardCount to a wrong
// value on purpose. Tolerates malformed `units`/`cards` (non-array, null, primitives) safely
// since several tests intentionally pass those to exercise the shape checks, not the count
// cross-check — Array.isArray guards and optional chaining prevent a computation crash.
function fakePack(overrides: Partial<Pack> = {}): Pack {
  const units = overrides.units ?? [];
  const unitCount = overrides.unitCount ?? (Array.isArray(units) ? units.length : 0);
  const cardCount = overrides.cardCount ?? (Array.isArray(units)
    ? units.reduce((sum: number, u: unknown) => {
        const cards = (u as { cards?: unknown } | null)?.cards;
        return sum + (Array.isArray(cards) ? cards.length : 0);
      }, 0)
    : 0);
  return {
    _version: 1,
    lang: "it",
    packVersion: "1.0.0",
    canonicalSource: "test",
    name: "Italian",
    nativeName: "Italiano",
    flag: "🇮🇹",
    unitCount,
    cardCount,
    units,
    ...overrides,
  };
}

describe("hasValidUnitsArray — array-level checks", () => {
  it("returns true for an empty units array", () => {
    expect(hasValidUnitsArray(fakePack({ units: [] }))).toBe(true);
  });

  it("returns false when units is a string", () => {
    expect(hasValidUnitsArray(fakePack({ units: "not-an-array" as unknown as [] }))).toBe(false);
  });

  it("returns false when units is null", () => {
    expect(hasValidUnitsArray(fakePack({ units: null as unknown as [] }))).toBe(false);
  });
});

describe("hasValidUnitsArray — unitCount/cardCount cross-check (Task #418)", () => {
  // Before #418, unitCount/cardCount were validated by TYPE only (typeof === "number"),
  // never cross-checked against the real units.length / summed cards.length —
  // lib/specialtyPackLoader.ts's _mergeFromJson arithmetically sums exactly these two
  // declared fields, so a pack whose declared count didn't match its real array length
  // passed validation and produced an arithmetically wrong but type-safe merged total.
  const oneUnitOneCard = {
    id: "u1",
    name: "Test",
    level: "A1" as const,
    theme: "Greetings",
    emoji: "👋",
    prerequisiteUnits: [],
    cards: [
      { id: "c1", type: "recognize", prompt: "ciao", accepted: ["hello"], tags: [], tier: 1 },
    ],
  };

  it("returns true when unitCount and cardCount exactly match the actual array lengths", () => {
    expect(hasValidUnitsArray(fakePack({ units: [oneUnitOneCard] as unknown as [] }))).toBe(true);
  });

  it("returns false when unitCount is declared higher than the actual units.length", () => {
    expect(hasValidUnitsArray(fakePack({ units: [oneUnitOneCard] as unknown as [], unitCount: 2 }))).toBe(false);
  });

  it("returns false when unitCount is declared lower than the actual units.length", () => {
    expect(hasValidUnitsArray(fakePack({ units: [oneUnitOneCard] as unknown as [], unitCount: 0 }))).toBe(false);
  });

  it("returns false when cardCount is declared higher than the actual summed cards.length", () => {
    expect(hasValidUnitsArray(fakePack({ units: [oneUnitOneCard] as unknown as [], cardCount: 5 }))).toBe(false);
  });

  it("returns false when cardCount is declared lower than the actual summed cards.length", () => {
    expect(hasValidUnitsArray(fakePack({ units: [oneUnitOneCard] as unknown as [], cardCount: 0 }))).toBe(false);
  });

  it("returns false when cardCount doesn't match the SUM across multiple units, even if each unit's own cards array is internally consistent", () => {
    const u2 = {
      ...oneUnitOneCard,
      id: "u2",
      cards: [
        { id: "c2", type: "recognize", prompt: "grazie", accepted: ["thanks"], tags: [], tier: 1 },
        { id: "c3", type: "recognize", prompt: "prego", accepted: ["please"], tags: [], tier: 1 },
      ],
    };
    // Real total is 1 + 2 = 3, but declared cardCount claims 2.
    expect(hasValidUnitsArray(fakePack({ units: [oneUnitOneCard, u2] as unknown as [], cardCount: 2 }))).toBe(false);
  });

  it("returns true when cardCount correctly sums across multiple units", () => {
    const u2 = {
      ...oneUnitOneCard,
      id: "u2",
      cards: [
        { id: "c2", type: "recognize", prompt: "grazie", accepted: ["thanks"], tags: [], tier: 1 },
        { id: "c3", type: "recognize", prompt: "prego", accepted: ["please"], tags: [], tier: 1 },
      ],
    };
    expect(hasValidUnitsArray(fakePack({ units: [oneUnitOneCard, u2] as unknown as [], cardCount: 3 }))).toBe(true);
  });
});

describe("hasValidUnitsArray — per-unit element-shape checks (Task #293)", () => {
  // Every non-optional Unit field — #392 extended the validator to cover level/theme/
  // emoji/prerequisiteUnits, which downstream UI dereferences unconditionally.
  const validUnit = {
    id: "u1",
    cards: [],
    name: "Test",
    level: "A1" as const,
    theme: "Greetings",
    emoji: "👋",
    prerequisiteUnits: [],
    order: 1,
  };

  it("returns true when all units have a string id and array cards", () => {
    expect(hasValidUnitsArray(fakePack({ units: [validUnit] as unknown as [] }))).toBe(true);
  });

  it("returns false when a unit has a non-string id (number)", () => {
    const badUnit = { ...validUnit, id: 42 };
    expect(hasValidUnitsArray(fakePack({ units: [badUnit] as unknown as [] }))).toBe(false);
  });

  it("returns false when a unit has a non-string id (undefined)", () => {
    const badUnit = { ...validUnit, id: undefined };
    expect(hasValidUnitsArray(fakePack({ units: [badUnit] as unknown as [] }))).toBe(false);
  });

  it("returns false when a unit has a non-array cards (null)", () => {
    const badUnit = { ...validUnit, cards: null };
    expect(hasValidUnitsArray(fakePack({ units: [badUnit] as unknown as [] }))).toBe(false);
  });

  it("returns false when a unit has a non-array cards (string)", () => {
    const badUnit = { ...validUnit, cards: "not-an-array" };
    expect(hasValidUnitsArray(fakePack({ units: [badUnit] as unknown as [] }))).toBe(false);
  });

  it("returns false when a unit is null", () => {
    expect(hasValidUnitsArray(fakePack({ units: [null] as unknown as [] }))).toBe(false);
  });

  it("returns false when a unit is a primitive (string)", () => {
    expect(hasValidUnitsArray(fakePack({ units: ["bad"] as unknown as [] }))).toBe(false);
  });

  it("returns false when any unit in a multi-unit array fails shape check", () => {
    const badUnit = { id: 999, cards: [] };
    expect(hasValidUnitsArray(fakePack({ units: [validUnit, badUnit] as unknown as [] }))).toBe(false);
  });

  it("returns true for multiple valid units", () => {
    const u2 = { ...validUnit, id: "u2" };
    expect(hasValidUnitsArray(fakePack({ units: [validUnit, u2] as unknown as [] }))).toBe(true);
  });
});

describe("hasValidUnitsArray — per-card element-shape checks (Task #417)", () => {
  // Before #417, every test in this file used cards: [] — the card-validation callback
  // (lib/packTypes.ts hasValidUnitsArray, inner .every over unit.cards) had zero coverage.
  // Deletion Test: replacing that callback with `return true;` made no existing test fail.
  // These tests construct a single malformed card per validated field, inside an otherwise
  // fully valid unit, so only the card-validation callback can be the cause of `false`.
  const validCard = {
    id: "c1",
    type: "recognize",
    prompt: "ciao",
    accepted: ["hello"],
    tags: [],
    tier: 1,
  };
  const unitWith = (cards: unknown[]) => ({
    id: "u1",
    cards,
    name: "Test",
    level: "A1" as const,
    theme: "Greetings",
    emoji: "👋",
    prerequisiteUnits: [],
  });

  it("returns true when a unit's card has all required fields with correct types", () => {
    expect(hasValidUnitsArray(fakePack({ units: [unitWith([validCard])] as unknown as [] }))).toBe(true);
  });

  it("returns false when a card has a non-string id (number)", () => {
    const badCard = { ...validCard, id: 42 };
    expect(hasValidUnitsArray(fakePack({ units: [unitWith([badCard])] as unknown as [] }))).toBe(false);
  });

  it("returns false when a card has a non-string type", () => {
    const badCard = { ...validCard, type: 7 };
    expect(hasValidUnitsArray(fakePack({ units: [unitWith([badCard])] as unknown as [] }))).toBe(false);
  });

  it("returns false when a card has a non-string prompt", () => {
    const badCard = { ...validCard, prompt: null };
    expect(hasValidUnitsArray(fakePack({ units: [unitWith([badCard])] as unknown as [] }))).toBe(false);
  });

  it("returns false when a card's accepted is not an array", () => {
    const badCard = { ...validCard, accepted: "hello" };
    expect(hasValidUnitsArray(fakePack({ units: [unitWith([badCard])] as unknown as [] }))).toBe(false);
  });

  it("returns false when a card's tags is not an array", () => {
    const badCard = { ...validCard, tags: "greeting" };
    expect(hasValidUnitsArray(fakePack({ units: [unitWith([badCard])] as unknown as [] }))).toBe(false);
  });

  it("returns true when a card has no prerequisites field at all — it is optional (Task #443)", () => {
    // validCard has no prerequisites key — must not be treated as missing/invalid.
    expect(hasValidUnitsArray(fakePack({ units: [unitWith([validCard])] as unknown as [] }))).toBe(true);
  });

  it("returns true when a card's prerequisites is a valid array of strings (Task #443)", () => {
    const goodCard = { ...validCard, prerequisites: ["c0", "c-2"] };
    expect(hasValidUnitsArray(fakePack({ units: [unitWith([goodCard])] as unknown as [] }))).toBe(true);
  });

  it("returns true when a card's prerequisites is an empty array (Task #443)", () => {
    const goodCard = { ...validCard, prerequisites: [] };
    expect(hasValidUnitsArray(fakePack({ units: [unitWith([goodCard])] as unknown as [] }))).toBe(true);
  });

  it("returns false when a card's prerequisites is a non-array-but-truthy value — the live crash path (Task #443)", () => {
    // lib/srs.ts:206 does `card.prerequisites?.length` — a non-empty STRING also has a
    // truthy .length, so it passes that check and reaches line 207's
    // `card.prerequisites.every(...)`, which strings don't have — a live TypeError in
    // store/srsStore.ts's getNewCards (the shipped Italian pack's FSRS new-card queue) and
    // the introduction engine. This is the exact malformed shape the validator must reject.
    const badCard = { ...validCard, prerequisites: "c0" };
    expect(hasValidUnitsArray(fakePack({ units: [unitWith([badCard])] as unknown as [] }))).toBe(false);
  });

  it("returns false when a card's prerequisites array contains a non-string element (Task #443)", () => {
    const badCard = { ...validCard, prerequisites: ["c0", 42] };
    expect(hasValidUnitsArray(fakePack({ units: [unitWith([badCard])] as unknown as [] }))).toBe(false);
  });

  it("returns false when a card has a non-number tier (string)", () => {
    const badCard = { ...validCard, tier: "1" };
    expect(hasValidUnitsArray(fakePack({ units: [unitWith([badCard])] as unknown as [] }))).toBe(false);
  });

  it("returns false when a card is null", () => {
    expect(hasValidUnitsArray(fakePack({ units: [unitWith([null])] as unknown as [] }))).toBe(false);
  });

  it("returns false when a card is a primitive (string)", () => {
    expect(hasValidUnitsArray(fakePack({ units: [unitWith(["bad"])] as unknown as [] }))).toBe(false);
  });

  it("returns false when one card among several in the same unit fails shape check", () => {
    const badCard = { ...validCard, id: 999 };
    expect(hasValidUnitsArray(fakePack({ units: [unitWith([validCard, badCard])] as unknown as [] }))).toBe(false);
  });
});

describe("hasValidUnitsArray — downstream-dereferenced unit fields (Task #392)", () => {
  const validUnit = {
    id: "u1",
    cards: [],
    name: "Test",
    level: "A1" as const,
    theme: "Greetings",
    emoji: "👋",
    prerequisiteUnits: [],
  };

  // Destructure-omit triggers no-unused-vars even for underscore-prefixed bindings —
  // delete on a copy sidesteps that without an eslint suppression.
  function without(key: keyof typeof validUnit): Record<string, unknown> {
    const copy: Record<string, unknown> = { ...validUnit };
    delete copy[key];
    return copy;
  }

  it("returns false when a unit is missing prerequisiteUnits (UI would crash on .every())", () => {
    expect(hasValidUnitsArray(fakePack({ units: [without("prerequisiteUnits")] as unknown as [] }))).toBe(false);
  });

  it("returns false when prerequisiteUnits is a non-array (string)", () => {
    const badUnit = { ...validUnit, prerequisiteUnits: "u0" };
    expect(hasValidUnitsArray(fakePack({ units: [badUnit] as unknown as [] }))).toBe(false);
  });

  it("returns false when a unit is missing level", () => {
    expect(hasValidUnitsArray(fakePack({ units: [without("level")] as unknown as [] }))).toBe(false);
  });

  it("returns false when level is not a registered CEFR level", () => {
    const badUnit = { ...validUnit, level: "C1" };
    expect(hasValidUnitsArray(fakePack({ units: [badUnit] as unknown as [] }))).toBe(false);
  });

  it("returns false when a unit is missing theme", () => {
    expect(hasValidUnitsArray(fakePack({ units: [without("theme")] as unknown as [] }))).toBe(false);
  });

  it("returns false when a unit is missing emoji", () => {
    expect(hasValidUnitsArray(fakePack({ units: [without("emoji")] as unknown as [] }))).toBe(false);
  });

  it("accepts each of the four registered levels", () => {
    for (const level of ["A1", "A2", "B1", "B2"]) {
      expect(hasValidUnitsArray(fakePack({ units: [{ ...validUnit, level }] as unknown as [] }))).toBe(true);
    }
  });
});
