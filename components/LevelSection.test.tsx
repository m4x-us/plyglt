// @vitest-environment jsdom
// ============================================================
// LevelSection.test.tsx — behavioral tests for LevelSection component
// ============================================================
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import LevelSection from "./LevelSection";
import type { Unit } from "@/content/types";

vi.mock("@/store/srsStore", () => ({
  unitMasteryPct: vi.fn(() => 0),
  MASTERY_GATE: 80,
}));

vi.mock("@/components/UnitRow", () => ({
  default: ({ unit }: { unit: Unit }) => <div data-testid="unit-row">{unit.name}</div>,
}));

function makeUnit(id: string, name: string): Unit {
  return { id, name, level: "A1", theme: "Test", emoji: "📚", prerequisiteUnits: [], cards: [] };
}

function makeProps(overrides: Partial<Parameters<typeof LevelSection>[0]> = {}) {
  return {
    lvl: "A1",
    label: "A1 — Beginner",
    prevLvl: "—",
    units: [],
    unlocked: true,
    masteryPct: 0,
    cards: {},
    unitMap: {},
    getStats: vi.fn(() => ({ due: 0, learning: 0, mastered: 0, total: 5, masteryPct: 0 })),
    ...overrides,
  };
}

describe("LevelSection", () => {
  afterEach(cleanup);

  it("renders the level label", () => {
    render(<LevelSection {...makeProps()} />);
    expect(screen.getByText("A1 — Beginner")).toBeDefined();
  });

  it("shows locked badge when unlocked is false", () => {
    render(<LevelSection {...makeProps({ unlocked: false })} />);
    expect(screen.getByText("🔒 locked")).toBeDefined();
  });

  it("renders unit names via UnitRow when unlocked", () => {
    const units = [makeUnit("u1", "Greetings"), makeUnit("u2", "Numbers")];
    render(<LevelSection {...makeProps({ units, unitMap: { u1: units[0]!, u2: units[1]! } })} />);
    expect(screen.getByText("Greetings")).toBeDefined();
    expect(screen.getByText("Numbers")).toBeDefined();
  });

  it("shows mastery percentage when unlocked and masteryPct > 0", () => {
    render(<LevelSection {...makeProps({ unlocked: true, masteryPct: 42 })} />);
    expect(screen.getByText("42% mastered")).toBeDefined();
  });
});
