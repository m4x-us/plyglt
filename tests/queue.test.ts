import { describe, it, expect, vi } from "vitest";
import { buildQueue, findUnitName } from "@/lib/queue";
import type { Card, Unit } from "@/content/types";

function card(id: string): Card {
  return { id, type: "produce", prompt: "p", accepted: ["a"], tags: [], tier: 1 };
}

function unit(name: string, cardIds: string[]): Unit {
  return {
    id: "u",
    name,
    level: "A1",
    theme: "t",
    emoji: "🧪",
    prerequisiteUnits: [],
    cards: cardIds.map(card),
  };
}

describe("buildQueue", () => {
  it("returns empty array when no due or new cards", () => {
    expect(buildQueue([], () => [], () => [])).toHaveLength(0);
  });

  it("returns due cards only when no new cards exist", () => {
    const c1 = card("c1"), c2 = card("c2");
    const result = buildQueue([c1, c2], () => ["c1", "c2"], () => []);
    expect(result.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("in global mode, new cards are never fetched", () => {
    const newSpy = vi.fn().mockReturnValue([]);
    buildQueue([card("c1")], () => ["c1"], newSpy, true);
    expect(newSpy).not.toHaveBeenCalled();
  });

  it("interleaves 1 new card after every 3 due cards", () => {
    // 6 due + 2 new → [d1,d2,d3,n1,d4,d5,d6,n2]
    const due = ["d1", "d2", "d3", "d4", "d5", "d6"].map(card);
    const news = ["n1", "n2"].map(card);
    const result = buildQueue(
      [...due, ...news],
      () => due.map((c) => c.id),
      () => news
    );
    expect(result.map((c) => c.id)).toEqual(["d1", "d2", "d3", "n1", "d4", "d5", "d6", "n2"]);
  });

  it("appends remaining new cards after all due cards are exhausted", () => {
    // 1 due + 3 new → [d1,n1,n2,n3] (1%3≠0, so no mid-session interleave)
    const due = [card("d1")];
    const news = ["n1", "n2", "n3"].map(card);
    const result = buildQueue(
      [...due, ...news],
      () => ["d1"],
      () => news
    );
    expect(result.map((c) => c.id)).toEqual(["d1", "n1", "n2", "n3"]);
  });

  it("deduplicates a card that appears in both due and new — keeps first occurrence", () => {
    const c1 = card("c1"), c2 = card("c2");
    const result = buildQueue(
      [c1, c2],
      () => ["c1"],     // c1 is due
      () => [c1, c2]   // c1 also in new pool (edge case)
    );
    // c1 appears from due; duplicate c1 from new is dropped; c2 from new is kept
    expect(result.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("preserves the order returned by getDueCards", () => {
    const cards = ["c1", "c2", "c3"].map(card);
    const result = buildQueue(cards, () => ["c3", "c1", "c2"], () => []);
    expect(result.map((c) => c.id)).toEqual(["c3", "c1", "c2"]);
  });
});

describe("findUnitName", () => {
  it("returns the unit name for a card that exists in a unit", () => {
    const units = [unit("Greetings", ["c1", "c2"])];
    expect(findUnitName("c1", units)).toBe("Greetings");
  });

  it("returns empty string for an unrecognised card ID", () => {
    expect(findUnitName("unknown", [])).toBe("");
  });
});
