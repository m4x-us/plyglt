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
import { ITALIAN } from "@/lib/language";
import { useSettingsStore } from "@/store/settingsStore";
import StudyCard from "./StudyCard";

// ── answerCheck mock — controls checkAnswer return value per test ─────────────
// Task (audit fix): StudyCard.tsx imports checkAnswer from "@/lib/answerCheck" directly,
// not from "@/lib/srs" (which only re-exports it). Mocking "@/lib/srs" here mocked a
// DIFFERENT module instance than the one StudyCard.tsx actually calls — every
// mockCheckAnswer.mockReturnValue(...) below was a no-op; tests 3/4/6/7 passed only because
// the real checkAnswer happened to agree with the mocked value for their literal typed
// inputs. Mocking the real import target makes the mock genuinely load-bearing.
vi.mock("@/lib/answerCheck", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/answerCheck")>();
  return { ...actual, checkAnswer: vi.fn() };
});
import { checkAnswer } from "@/lib/answerCheck";
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
    useSettingsStore.setState({ sourceLang: "en" });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // ── 1: renders without crashing ──────────────────────────────────────────────
  it("renders without crashing given a produce card", () => {
    expect(() =>
      render(<StudyCard card={makeCard()} lang={ITALIAN} cardNumber={1} totalCards={5} onRate={onRate} />)
    ).not.toThrow();
  });

  // ── 2: text input accepts typed answers ───────────────────────────────────────
  it("text input accepts typed answers", () => {
    render(<StudyCard card={makeCard()} lang={ITALIAN} cardNumber={1} totalCards={5} onRate={onRate} />);
    const input = screen.getByPlaceholderText("Type your answer...") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "il gatto" } });
    expect(input.value).toBe("il gatto");
  });

  // ── 3: correct answer → non-again grade after flash timer ────────────────────
  it("submitting a correct answer calls onRate with a non-again grade", () => {
    mockCheckAnswer.mockReturnValue("correct");
    render(<StudyCard card={makeCard()} lang={ITALIAN} cardNumber={1} totalCards={5} onRate={onRate} />);
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
    render(<StudyCard card={makeCard()} lang={ITALIAN} cardNumber={1} totalCards={5} onRate={onRate} />);
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
    render(<StudyCard card={makeCard()} lang={ITALIAN} cardNumber={1} totalCards={5} onRate={onRate} />);
    expect(screen.getByText("the cat").textContent).toBe("the cat");
  });

  // ── 6: correct answer → feedback string is visible ───────────────────────────
  it("shows the correct answer in the result phase after a correct submission", () => {
    mockCheckAnswer.mockReturnValue("correct");
    render(<StudyCard card={makeCard()} lang={ITALIAN} cardNumber={1} totalCards={5} onRate={onRate} />);
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
    // Now that the mock correctly targets @/lib/answerCheck (the module StudyCard.tsx
    // actually imports), the beforeEach default of "correct" no longer coincidentally
    // matches — this test must set its own return value like tests 3/4/6 already do.
    mockCheckAnswer.mockReturnValue("close");
    const { container } = render(<StudyCard card={makeCard()} lang={ITALIAN} cardNumber={1} totalCards={5} onRate={onRate} />);
    const input = screen.getByPlaceholderText("Type your answer...");
    // "il gato" is edit-distance-1 from accepted "il gatto" — checkAnswer returns "close"
    fireEvent.change(input, { target: { value: "il gato" } });
    fireEvent.click(screen.getByText("Check →"));
    expect(container.querySelector(".border-yellow-500")).toBeInTheDocument();
    expect(screen.getByText("Quasi! Close enough.").textContent).toBe("Quasi! Close enough.");
  });

  // ── 8: real settingsStore.sourceLang reaches getPrompt/getAccepted (Task: multi-language
  // architecture prep) — proves the Batch 11 Spanish-source-for-Italian content (content/
  // cards/*.ts's `prompts: { es: ... }` / `translations: { es: [...] }` maps) is reachable
  // through the real app, not dead data. B7 target: reverting StudyCard's `sourceLang` read
  // back to a hardcoded "en" constant makes both assertions below fail — the Spanish prompt
  // would never be looked up, and the canonical English prompt would render instead. ─────
  it("renders a card's Spanish prompt/accepted text when settingsStore.sourceLang is 'es' (Batch 11 content reactivated)", () => {
    useSettingsStore.setState({ sourceLang: "es" });
    const esCard = makeCard({
      type: "produce",
      prompt: "good morning / good day",
      prompts: { es: "buenos días" },
      accepted: ["buongiorno"],
    });
    render(<StudyCard card={esCard} lang={ITALIAN} cardNumber={1} totalCards={5} onRate={onRate} />);

    // The Spanish prompt is shown, not the canonical English one.
    expect(screen.getByText("buenos días")).toBeInTheDocument();
    expect(screen.queryByText("good morning / good day")).not.toBeInTheDocument();
  });

  it("falls back to the canonical English prompt when sourceLang is 'es' but the card has no Spanish translation", () => {
    useSettingsStore.setState({ sourceLang: "es" });
    // makeCard()'s default card has no `prompts` map at all — getPrompt must fall back to
    // the canonical `card.prompt`, not render nothing / throw.
    render(<StudyCard card={makeCard()} lang={ITALIAN} cardNumber={1} totalCards={5} onRate={onRate} />);
    expect(screen.getByText("the cat")).toBeInTheDocument();
  });

  // ── 9-11: audit fix — recognize-card grading and label use the SOURCE language's rules,
  // not the target language's (F1, sev 7). These use the REAL, un-mocked checkAnswer (via
  // vi.mocked(...).mockReturnValue is NOT called in these three tests, so the actual
  // lib/answerCheck implementation runs) so the assertions prove real grading behavior, not
  // a mocked stand-in. B7 target: reverting StudyCard's `answerArticles` back to always using
  // `lang.articles` (the target-language regex) makes test 9 fail — "libro" would be graded
  // "wrong" against "el libro" since ITALIAN_ARTICLES does not strip Spanish "el".
  it("grades a recognize card's Spanish accepted answer using Spanish article-stripping, not the target language's", async () => {
    // vi.importActual bypasses the vi.mock factory above to fetch the REAL checkAnswer —
    // mockRestore() would only reset to an empty vi.fn(), not the original implementation,
    // since this mock was never created via vi.spyOn on a real function.
    const { checkAnswer: realCheckAnswer } = await vi.importActual<typeof import("@/lib/answerCheck")>("@/lib/answerCheck");
    mockCheckAnswer.mockImplementation(realCheckAnswer);
    useSettingsStore.setState({ sourceLang: "es" });
    const recognizeCard = makeCard({
      id: "test-recognize-01",
      type: "recognize",
      prompt: "libro",
      accepted: ["the book"],
      translations: { es: ["el libro"] },
    });
    render(<StudyCard card={recognizeCard} lang={ITALIAN} cardNumber={1} totalCards={5} onRate={onRate} />);
    const input = screen.getByPlaceholderText("Type your answer...");
    // Typing "libro" (omitting the article, exactly what article-stripping exists to forgive)
    // must be graded correct against "el libro" once sourceLang is Spanish.
    fireEvent.change(input, { target: { value: "libro" } });
    fireEvent.click(screen.getByText("Check →"));
    act(() => { vi.advanceTimersByTime(1400); });
    expect(onRate).toHaveBeenCalledOnce();
    const grade = onRate.mock.calls[0]![0]!;
    expect(grade).not.toBe("again");
  });

  it("still grades a recognize card's English accepted answer correctly when sourceLang is 'en' (regression guard)", async () => {
    const { checkAnswer: realCheckAnswer } = await vi.importActual<typeof import("@/lib/answerCheck")>("@/lib/answerCheck");
    mockCheckAnswer.mockImplementation(realCheckAnswer);
    useSettingsStore.setState({ sourceLang: "en" });
    const recognizeCard = makeCard({
      id: "test-recognize-02",
      type: "recognize",
      prompt: "libro",
      accepted: ["the book"],
    });
    render(<StudyCard card={recognizeCard} lang={ITALIAN} cardNumber={1} totalCards={5} onRate={onRate} />);
    const input = screen.getByPlaceholderText("Type your answer...");
    fireEvent.change(input, { target: { value: "the book" } });
    fireEvent.click(screen.getByText("Check →"));
    act(() => { vi.advanceTimersByTime(1400); });
    expect(onRate).toHaveBeenCalledOnce();
    const grade = onRate.mock.calls[0]![0]!;
    expect(grade).not.toBe("again");
  });

  it("labels a recognize card 'Translate to Español' when sourceLang is 'es', not the hardcoded 'Translate to English'", () => {
    useSettingsStore.setState({ sourceLang: "es" });
    const recognizeCard = makeCard({ id: "test-recognize-03", type: "recognize", prompt: "libro", accepted: ["the book"] });
    render(<StudyCard card={recognizeCard} lang={ITALIAN} cardNumber={1} totalCards={5} onRate={onRate} />);
    expect(screen.getByText("Translate to Español")).toBeInTheDocument();
    expect(screen.queryByText("Translate to English")).not.toBeInTheDocument();
  });

  it("still labels a non-recognize card from the target LanguageConfig's cardLabels (unaffected by sourceLang)", () => {
    useSettingsStore.setState({ sourceLang: "es" });
    render(<StudyCard card={makeCard({ type: "produce" })} lang={ITALIAN} cardNumber={1} totalCards={5} onRate={onRate} />);
    expect(screen.getByText("Type in Italian")).toBeInTheDocument();
  });
});
