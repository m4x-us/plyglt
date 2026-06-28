// ============================================================
// UnitRow.test.tsx — Tests for UnitRow unit list row component
// ============================================================
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import UnitRow from "./UnitRow";
import type { Unit } from "@/content/types";

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: "u1",
    name: "Greetings",
    level: "A1",
    theme: "Social",
    emoji: "👋",
    prerequisiteUnits: [],
    cards: [],
    ...overrides,
  };
}

const baseStats = { due: 0, learning: 0, mastered: 0, total: 5, masteryPct: 0 };

describe("UnitRow", () => {
  afterEach(cleanup);
  it("renders the unit name", () => {
    render(<UnitRow unit={makeUnit({ name: "Food & Drinks" })} stats={baseStats} masteryPct={0} unlocked isComplete={false} />);
    expect(screen.getByText("Food & Drinks")).toBeDefined();
  });

  it("shows the ready badge when stats.due > 0", () => {
    render(<UnitRow unit={makeUnit()} stats={{ ...baseStats, due: 3 }} masteryPct={0} unlocked isComplete={false} />);
    expect(screen.getByText("3 ready")).toBeDefined();
  });

  it("badge renders 'ready' not 'due'", () => {
    render(<UnitRow unit={makeUnit()} stats={{ ...baseStats, due: 7 }} masteryPct={0} unlocked isComplete={false} />);
    expect(screen.getByText("7 ready")).toBeDefined();
    expect(screen.queryByText(/\d+ due/)).toBeNull();
  });

  it("does not show ready badge when stats.due === 0", () => {
    render(<UnitRow unit={makeUnit()} stats={baseStats} masteryPct={0} unlocked isComplete={false} />);
    expect(screen.queryByText(/\d+ ready/)).toBeNull();
  });

  it("renders locked state (lock emoji) when unlocked is false", () => {
    render(<UnitRow unit={makeUnit()} stats={baseStats} masteryPct={0} unlocked={false} isComplete={false} />);
    const locks = screen.getAllByText("🔒");
    expect(locks.length).toBeGreaterThan(0);
  });

  it("renders a Link to /study when unlocked", () => {
    const { container } = render(<UnitRow unit={makeUnit({ id: "unit-42" })} stats={baseStats} masteryPct={0} unlocked isComplete={false} />);
    const anchor = container.querySelector("a");
    expect(anchor?.getAttribute("href")).toBe("/study?unit=unit-42");
  });
});
