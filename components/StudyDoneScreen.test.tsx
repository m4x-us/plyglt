// ============================================================
// StudyDoneScreen.test.tsx — Tests for StudyDoneScreen end-of-session component
// ============================================================
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import StudyDoneScreen from "./StudyDoneScreen";
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

const baseProps = {
  isInterrupt: false,
  isGlobal: false,
  unit: makeUnit(),
  sessionCorrect: 8,
  sessionTotal: 10,
  pct: 80,
  stillDue: 0,
  onHome: vi.fn(),
  onStudyMore: null,
  onExitInterrupt: vi.fn().mockResolvedValue(undefined),
};

describe("StudyDoneScreen", () => {
  afterEach(cleanup);

  it("renders 'Session complete.' with no exclamation mark", () => {
    render(<StudyDoneScreen {...baseProps} />);
    expect(screen.getByText("Session complete.")).toBeDefined();
    expect(screen.queryByText(/!/)).toBeNull();
  });

  it("renders no 🎉 emoji", () => {
    render(<StudyDoneScreen {...baseProps} />);
    expect(screen.queryByText("🎉")).toBeNull();
  });

  it("renders 'Session complete.' for global done screen", () => {
    render(<StudyDoneScreen {...baseProps} isGlobal unit={null} />);
    expect(screen.getByText("Session complete.")).toBeDefined();
  });

  it("renders 'Review complete.' for interrupt done screen", () => {
    render(<StudyDoneScreen {...baseProps} isInterrupt />);
    expect(screen.getByText("Review complete.")).toBeDefined();
    expect(screen.queryByText(/!/)).toBeNull();
  });
});
