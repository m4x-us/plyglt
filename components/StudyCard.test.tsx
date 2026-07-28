// @vitest-environment jsdom
// ===========================================
// STUDYCARD COMPONENT TESTS (Rule 14)
// ===========================================
// Co-located tests for StudyCard.tsx — the primary interactive study component.
// Tests the submit/rating flow, wrong-answer accumulation, and UI rendering.
// ===========================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import type { Card } from "@/content/types";
import type { Grade } from "@/lib/srs";
import StudyCard from "./StudyCard";

// ── srs mock — controls checkAnswer return value per test ─────────────────────
vi.mock("@/lib/srs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/srs")>();
  return { ...actual, checkAnswer: vi.fn() };
});
import { checkAnswer } from "@/lib/srs";
const mockCheckAnswer = vi.mocked(checkAnswer);

// ── minimal produce card ───────────────────────────────────────────────────────
function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: "test-card-01",
    type: "produce",
    prompt: "the cat",
    accepted: ["il gatto"],
    tags: [],
    tier: 1,
    ...overrides,
  };
}

describe("StudyCard", () => {
  // Typed mock satisfies StudyCard's `onRate: (grade: Grade) => void` prop signature.
  let onRate: ReturnType<typeof vi.fn<(grade: Grade) => void>>;

  beforeEach(() => {
    onRate = vi.fn<(grade: Grade) => void>();
    vi.useFakeTimers();
    mockCheckAnswer.mockReturnValue("correct");
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // ── 1: renders without crashing ──────────────────────────────────────────────
  it("renders without crashing given a produce card", () => {
    expect(() =>
      render(<StudyCard card={makeCard()} cardNumber={1} totalCards={5} onRate={onRate} />)
    ).not.toThrow();
  });

  // ── 2: text input accepts typed answers ───────────────────────────────────────
  it("text input accepts typed answers", () => {
    render(<StudyCard card={makeCard()} cardNumber={1} totalCards={5} onRate={onRate} />);
    const input = screen.getByPlaceholderText("Type your answer...") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "il gatto" } });
    expect(input.value).toBe("il gatto");
  });

  // ── 3: correct answer → non-again grade after flash timer ────────────────────
  it("submitting a correct answer calls onRate with a non-again grade", () => {
    mockCheckAnswer.mockReturnValue("correct");
    render(<StudyCard card={makeCard()} cardNumber={1} totalCards={5} onRate={onRate} />);
    const input = screen.getByPlaceholderText("Type your answer...");
    fireEvent.change(input, { target: { value: "il gatto" } });
    fireEvent.click(screen.getByText("Check →"));
    // onRate is NOT called immediately — it fires after FLASH_MS (1400ms)
    expect(onRate).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1400); });
    expect(onRate).toHaveBeenCalledOnce();
    // toHaveBeenCalledOnce() guarantees calls[0] exists — non-null assertion is safe.
    const grade = onRate.mock.calls[0]![0]!;
    expect(grade).not.toBe("again");
  });

  // ── 4: wrong answer twice then giveUp → onRate("again") ──────────────────────
  it("submitting a wrong answer and pressing Continue calls onRate('again')", () => {
    mockCheckAnswer.mockReturnValue("wrong");
    render(<StudyCard card={makeCard()} cardNumber={1} totalCards={5} onRate={onRate} />);
    const input = screen.getByPlaceholderText("Type your answer...");

    // First wrong attempt: attempts=1, showAnswer=false, Check button still visible
    fireEvent.change(input, { target: { value: "nope" } });
    fireEvent.click(screen.getByText("Check →"));

    // Second wrong attempt: attempts=2, showAnswer=true, "Continue →" appears
    fireEvent.click(screen.getByText("Check →"));

    // Click Continue → giveUp() → onRate("again")
    fireEvent.click(screen.getByText("Continue →"));
    expect(onRate).toHaveBeenCalledWith("again");
  });

  // ── 5: card shows the prompt text ────────────────────────────────────────────
  it("shows the prompt text from the card", () => {
    render(<StudyCard card={makeCard()} cardNumber={1} totalCards={5} onRate={onRate} />);
    expect(screen.getByText("the cat").textContent).toBe("the cat");
  });

  // ── 6: correct answer → feedback string is visible ───────────────────────────
  it("shows the correct answer in the result phase after a correct submission", () => {
    mockCheckAnswer.mockReturnValue("correct");
    render(<StudyCard card={makeCard()} cardNumber={1} totalCards={5} onRate={onRate} />);
    const input = screen.getByPlaceholderText("Type your answer...");
    fireEvent.change(input, { target: { value: "il gatto" } });
    fireEvent.click(screen.getByText("Check →"));
    // Result phase: the canonical accepted answer is shown
    // "il gatto" typed matches the canonical answer exactly, so the "You typed" label
    // (only shown when typed !== canonical) is suppressed — it appears exactly once,
    // in the result panel's canonical-answer span.
    const matches = screen.getAllByText("il gatto");
    expect(matches).toHaveLength(1);
  });

  // ── 7: wasClose=true → yellow border and closeFeedback string ────────────────
  it("shows yellow border and closeFeedback text when answer is close", () => {
    const { container } = render(<StudyCard card={makeCard()} cardNumber={1} totalCards={5} onRate={onRate} />);
    const input = screen.getByPlaceholderText("Type your answer...");
    // "il gato" is edit-distance-1 from accepted "il gatto" — checkAnswer returns "close"
    fireEvent.change(input, { target: { value: "il gato" } });
    fireEvent.click(screen.getByText("Check →"));
    expect(container.querySelector(".border-yellow-500")).toBeInTheDocument();
    expect(screen.getByText("Quasi! Close enough.").textContent).toBe("Quasi! Close enough.");
  });
});
