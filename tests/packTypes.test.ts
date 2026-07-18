import { describe, it, expect } from "vitest";
import { hasValidUnitsArray } from "@/lib/packTypes";
import type { Pack } from "@/lib/packTypes";

function fakePack(overrides: Partial<Pack> = {}): Pack {
  return {
    _version: 1,
    lang: "it",
    packVersion: "1.0.0",
    canonicalSource: "test",
    name: "Italian",
    nativeName: "Italiano",
    flag: "🇮🇹",
    unitCount: 0,
    cardCount: 0,
    units: [],
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
