// ============================================================
// page.test.tsx — Behavioral tests for app/learn/page.tsx (Home)
// ============================================================
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { Unit } from "@/content/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/tauri", () => ({
  updateTrayBadge: vi.fn(),
  listen: vi.fn().mockResolvedValue(() => {}),
  isTauri: false,
  openExternalUrl: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  useIsHydrated: () => true,
  createPlatformStorage: vi.fn(),
}));

vi.mock("@/store/srsStore", () => ({
  useSRSStore: vi.fn(() => ({
    cards: {},
    streak: 5,
    getStats: () => ({ due: 0, seen: 0, total: 0 }),
  })),
  MASTERY_GATE: 80,
  levelMasteryPct: vi.fn(() => 0),
  currentStudyLevel: vi.fn(() => "A1"),
}));

vi.mock("@/hooks/useLangPack", () => ({
  useLangPack: vi.fn(),
}));

// Stub LevelSection — avoids rendering complex nested unit structure.
// Exposes lvl and unlocked as data attributes so tests can assert lock state.
vi.mock("@/components/LevelSection", () => ({
  default: ({ lvl, label, unlocked }: { lvl: string; label: string; unlocked: boolean }) => (
    <div data-testid={`level-${lvl}`} data-unlocked={String(unlocked)}>{label}</div>
  ),
}));

import { useLangPack } from "@/hooks/useLangPack";
import Home from "./page";

const LANG_STUB = {
  code: "it",
  name: "Italian",
  nativeName: "Italiano",
  flag: "🇮🇹",
  articles: null,
  diacriticTolerant: true,
  uiStrings: {
    appTitle: "Italian",
    appSubtitle: "A1–B2",
    correctFeedback: "Correct.",
    closeFeedback: "Close.",
    cardLabels: {} as Record<string, string>,
    curriculumCredit: "Curriculum",
  },
};

function langPackStub(units: Unit[]) {
  return {
    units,
    unitMap: Object.fromEntries(units.map((u) => [u.id, u])),
    lang: LANG_STUB,
    loading: false,
    error: null,
  };
}

function makeUnit(id: string, level: "A1" | "A2" | "B1" | "B2"): Unit {
  return {
    id,
    name: `Unit ${id}`,
    level,
    theme: "Test",
    emoji: "📚",
    prerequisiteUnits: [],
    cards: [],
  };
}

afterEach(cleanup);

describe("app/learn/page.tsx — Home", () => {
  it("renders stats strip labels from pack data", () => {
    vi.mocked(useLangPack).mockReturnValue(langPackStub([]));
    render(<Home />);
    screen.getByText("cards ready");
    screen.getByText("day streak 🔥");
  });

  it("renders a LevelSection for each level that has units", () => {
    vi.mocked(useLangPack).mockReturnValue(
      langPackStub([makeUnit("a1-u1", "A1"), makeUnit("a2-u1", "A2")])
    );
    render(<Home />);
    screen.getByTestId("level-A1");
    screen.getByTestId("level-A2");
  });

  it("passes unlocked=true to A1 and unlocked=false to A2 when A1 mastery is below the gate", () => {
    vi.mocked(useLangPack).mockReturnValue(
      langPackStub([makeUnit("a1-u1", "A1"), makeUnit("a2-u1", "A2")])
    );
    render(<Home />);
    // A1 is LEVELS[0] — always unlocked regardless of mastery
    expect(screen.getByTestId("level-A1").dataset.unlocked).toBe("true");
    // A2 requires A1 mastery >= MASTERY_GATE (80); mocked levelMasteryPct returns 0 → locked
    expect(screen.getByTestId("level-A2").dataset.unlocked).toBe("false");
  });
});
