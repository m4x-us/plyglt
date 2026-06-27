import { describe, it, expect } from "vitest";
import { TIER_LABELS, tierLabel } from "@/lib/cardLabels";

describe("TIER_LABELS", () => {
  it("has exactly 4 entries (tiers 1–4)", () => {
    expect(Object.keys(TIER_LABELS).length).toBe(4);
  });

  it("maps tier 1 to Vocabulary", () => expect(TIER_LABELS[1]).toBe("Vocabulary"));
  it("maps tier 2 to Grammar",    () => expect(TIER_LABELS[2]).toBe("Grammar"));
  it("maps tier 3 to Phrases",    () => expect(TIER_LABELS[3]).toBe("Phrases"));
  it("maps tier 4 to Sentences",  () => expect(TIER_LABELS[4]).toBe("Sentences"));
});

describe("tierLabel()", () => {
  it("returns 'Vocabulary' for tier 1", () => expect(tierLabel(1)).toBe("Vocabulary"));
  it("returns 'Grammar'    for tier 2", () => expect(tierLabel(2)).toBe("Grammar"));
  it("returns 'Phrases'    for tier 3", () => expect(tierLabel(3)).toBe("Phrases"));
  it("returns 'Sentences'  for tier 4", () => expect(tierLabel(4)).toBe("Sentences"));
  it("returns empty string for unknown tier 0",  () => expect(tierLabel(0)).toBe(""));
  it("returns empty string for unknown tier 99", () => expect(tierLabel(99)).toBe(""));
});
