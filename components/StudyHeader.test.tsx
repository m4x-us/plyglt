// ============================================================
// StudyHeader.test.tsx — Tests for the study screen's top bar
// ============================================================
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import StudyHeader from "./StudyHeader";

const BASE_PROPS = {
  isInterrupt: false,
  isGlobal: false,
  headerTitle: "📘 Greetings",
  onSnooze: vi.fn(),
  snoozeMinutes: 30,
  onHome: vi.fn(),
  pos: 0,
  queueLength: 8,
  unitName: "",
  tier: 1,
  sessionCorrect: 3,
  sessionTotal: 5,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("StudyHeader", () => {
  it("shows the unit title as a back button, not the snooze button, in unit mode", () => {
    render(<StudyHeader {...BASE_PROPS} />);
    expect(screen.getByText("← 📘 Greetings")).toBeInTheDocument();
    expect(screen.queryByText(/Snooze/)).not.toBeInTheDocument();
  });

  it("calls onHome when the back button is clicked", () => {
    const onHome = vi.fn();
    render(<StudyHeader {...BASE_PROPS} onHome={onHome} />);
    fireEvent.click(screen.getByText("← 📘 Greetings"));
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it("shows the snooze button, not the back button, in interrupt mode", () => {
    render(<StudyHeader {...BASE_PROPS} isInterrupt={true} snoozeMinutes={15} />);
    expect(screen.getByText("Snooze 15 min")).toBeInTheDocument();
    expect(screen.queryByText("← 📘 Greetings")).not.toBeInTheDocument();
  });

  it("calls onSnooze (not onHome) when the snooze button is clicked", () => {
    const onSnooze = vi.fn();
    const onHome = vi.fn();
    render(<StudyHeader {...BASE_PROPS} isInterrupt={true} onSnooze={onSnooze} onHome={onHome} />);
    fireEvent.click(screen.getByText(/Snooze/));
    expect(onSnooze).toHaveBeenCalledTimes(1);
    expect(onHome).not.toHaveBeenCalled();
  });

  it("shows the live pos/queueLength badge in interrupt mode, reflecting a grown queue", () => {
    // Task (2026-08-21): queueLength must be read live, not frozen at session start — this
    // is the exact badge that proves a session grown by useInterruptSessionGrowth.ts is
    // visible to the user, not just internally tracked.
    render(<StudyHeader {...BASE_PROPS} isInterrupt={true} pos={5} queueLength={11} />);
    expect(screen.getByText("6/11")).toBeInTheDocument();
  });

  it("does not show the pos/queueLength badge outside interrupt mode", () => {
    render(<StudyHeader {...BASE_PROPS} isInterrupt={false} pos={5} queueLength={11} />);
    expect(screen.queryByText("6/11")).not.toBeInTheDocument();
  });

  it("shows the unit name badge in global mode when unitName is set", () => {
    render(<StudyHeader {...BASE_PROPS} isGlobal={true} unitName="Food & Drink" />);
    expect(screen.getByText("Food & Drink")).toBeInTheDocument();
  });

  it("does not show a unit name badge when unitName is empty", () => {
    render(<StudyHeader {...BASE_PROPS} isGlobal={true} unitName="" />);
    // Only the tier badge and correct-count text should be present alongside the header.
    expect(screen.queryByText("", { selector: "span.bg-gray-800.text-gray-400" })).not.toBeInTheDocument();
  });

  it("shows the tier label for the current card's tier", () => {
    render(<StudyHeader {...BASE_PROPS} tier={3} />);
    expect(screen.getByText(/Tier 3/)).toBeInTheDocument();
  });

  it("shows the session correct/total count once at least one card has been rated", () => {
    render(<StudyHeader {...BASE_PROPS} sessionCorrect={4} sessionTotal={6} />);
    expect(screen.getByText("4/6 correct")).toBeInTheDocument();
  });

  it("hides the correct/total count before any card has been rated (sessionTotal 0)", () => {
    render(<StudyHeader {...BASE_PROPS} sessionCorrect={0} sessionTotal={0} />);
    expect(screen.queryByText(/correct/)).not.toBeInTheDocument();
  });
});
