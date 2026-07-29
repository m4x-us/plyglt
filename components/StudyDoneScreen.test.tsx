// ============================================================
// StudyDoneScreen.test.tsx — Tests for StudyDoneScreen end-of-session component
// ============================================================
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
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
    expect(screen.getByText("Session complete.")).toBeInTheDocument();
    expect(screen.queryByText(/!/)).toBeNull();
  });

  it("renders no 🎉 emoji", () => {
    render(<StudyDoneScreen {...baseProps} />);
    expect(screen.queryByText("🎉")).toBeNull();
  });

  it("renders 'Session complete.' for global done screen", () => {
    render(<StudyDoneScreen {...baseProps} isGlobal unit={null} />);
    expect(screen.getByText("Session complete.")).toBeInTheDocument();
  });

  it("renders 'Review complete.' for interrupt done screen", () => {
    render(<StudyDoneScreen {...baseProps} isInterrupt />);
    expect(screen.getByText("Review complete.")).toBeInTheDocument();
    expect(screen.queryByText(/!/)).toBeNull();
  });

  // Task #506 — the interrupt-mode "Done" button previously had no error handling around
  // onExitInterrupt(): a rejection left onHome() uncalled, stranding the user on this screen
  // with the mandatory-mode window lock still engaged. This test fails if that regression
  // reappears — it asserts onHome() still fires when onExitInterrupt() rejects.
  it("still calls onHome when onExitInterrupt rejects", async () => {
    const onHome = vi.fn();
    const onExitInterrupt = vi.fn().mockRejectedValue(new Error("Tauri IPC failed"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<StudyDoneScreen {...baseProps} isInterrupt onHome={onHome} onExitInterrupt={onExitInterrupt} />);

    await act(async () => {
      fireEvent.click(screen.getByText("Done"));
    });

    expect(onExitInterrupt).toHaveBeenCalledTimes(1);
    expect(onHome).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("ERR-IPC-EXIT"), expect.any(Error));

    errorSpy.mockRestore();
  });
});
