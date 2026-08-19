// @vitest-environment jsdom
// ============================================================
// app/study/pageSessionRemount.test.tsx — Regression: Task #654
// ============================================================
// app/study/page.test.tsx mocks @/hooks/useStudySession entirely, so it cannot observe
// whether the hook's internal state (queue/pos/mountFillStartedRef/resumeDecision) actually
// resets across a same-pathname, query-string-only navigation — the exact thing Task #654's
// bug lived in. This file uses the REAL useStudySession hook and REAL srsStore against a
// minimal two-unit fixture, driving app/study/page.tsx through testing-library's rerender()
// (which mirrors Next.js App Router's behavior of NOT unmounting a client component on a
// same-pathname navigation, unless a `key` forces it).
//
// Root cause (tasks.md Task #654): StudyInner had no `key`, so a unit-A → unit-B (or, in
// production, unit/global → interrupt) navigation reused the same useStudySession hook
// instance. Its one-shot mountFillStartedRef stayed spent and its resume-decision effect
// (keyed only on [hydrated]) never re-ran, so `queue`/`pos` stayed frozen at unit A's
// completed session while the header relabeled to unit B.
//
// Deletion Test: reverting app/study/page.tsx's `<StudyInner key={sessionKey} />` back to a
// bare `<StudyInner />` makes this test fail — the page would still show unit A's
// StudyDoneScreen after navigating to unit B, instead of unit B's fresh StudyCard.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { useSRSStore } from "@/store/srsStore";
import type { Unit } from "@/content/types";

const { mockRouterPush } = vi.hoisted(() => ({ mockRouterPush: vi.fn() }));

// Mutable — mirrors a real Next.js query-string-only navigation (unit changes, mode stays
// unset). Both StudyPageKeyed's own useSearchParams() call and StudyInner's internal one
// read from this same mutable source, exactly like the real next/navigation hook would.
const searchParamsState = vi.hoisted(() => ({ unit: "unitA" as string, mode: null as string | null }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush, replace: vi.fn() }),
  useSearchParams: () => ({
    get: (k: string) => (k === "unit" ? searchParamsState.unit : k === "mode" ? searchParamsState.mode : null),
  }),
}));

const CARD_A1 = {
  id: "unitA-card-1",
  type: "recognize" as const,
  prompt: "ciao",
  accepted: ["hello"],
  tags: ["greeting"],
  tier: 1 as const,
  deprecated: false,
};

const CARD_B1 = {
  id: "unitB-card-1",
  type: "recognize" as const,
  prompt: "arrivederci",
  accepted: ["goodbye"],
  tags: ["greeting"],
  tier: 1 as const,
  deprecated: false,
};

const UNIT_A: Unit = { id: "unitA", name: "Unit A", level: "A1", theme: "test", emoji: "🅰️", prerequisiteUnits: [], cards: [CARD_A1] };
const UNIT_B: Unit = { id: "unitB", name: "Unit B", level: "A1", theme: "test", emoji: "🅱️", prerequisiteUnits: [], cards: [CARD_B1] };

vi.mock("@/hooks/useLangPack", () => ({
  useLangPack: () => ({
    units: [UNIT_A, UNIT_B],
    unitMap: { unitA: UNIT_A, unitB: UNIT_B },
    lang: {
      code: "xx-test", name: "Test", nativeName: "Test", flag: "🧪", articles: null, diacriticTolerant: false,
      uiStrings: {
        appTitle: "plyglt", appSubtitle: "test", correctFeedback: "Correct.", closeFeedback: "Close.",
        cardLabels: { produce: "Type", recognize: "Translate", conjugate: "Conjugate", fill_blank: "Fill in", passage_cloze: "Read" },
        curriculumCredit: "Test",
      },
    },
    loading: false,
  }),
}));

vi.mock("@/lib/storage", () => ({
  createPlatformStorage: () => ({
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  }),
  useIsHydrated: () => true,
  useIsHydratedStrict: () => true,
}));

vi.mock("@/lib/tauri", () => ({
  isTauri: false,
  invoke: vi.fn(),
  listen: vi.fn().mockResolvedValue(() => {}),
  exitMandatoryMode: vi.fn().mockResolvedValue(undefined),
  snoozeInterrupt: vi.fn().mockResolvedValue(undefined),
  updateTrayBadge: vi.fn(),
  openExternalUrl: vi.fn(),
}));

vi.mock("@/lib/entitlement", () => ({
  CHECKOUT_URLS: { annual: "https://pay.example.com/annual" },
  CUSTOMER_PORTAL_URL: "https://pay.example.com/portal",
  PRICING: { annual: "$34.99/yr" },
}));

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn().mockResolvedValue({
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
    has: vi.fn().mockResolvedValue(false),
    delete: vi.fn().mockResolvedValue(undefined),
    entries: vi.fn().mockResolvedValue([]),
    keys: vi.fn().mockResolvedValue([]),
  }),
}));

// Real StudyCard renders too much unrelated UI chrome for this test's purposes — a minimal
// double exposing the card id and a "rate good" button is enough to drive handleRate for real.
vi.mock("@/components/StudyCard", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: ({ card, onRate }: any) => (
    <div data-testid="study-card" data-card-id={card.id}>
      StudyCard:{card.id}
      <button onClick={() => onRate("good")}>Rate good</button>
    </div>
  ),
}));

vi.mock("@/components/StudyDoneScreen", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: ({ sessionCorrect, sessionTotal }: any) => (
    <div data-testid="study-done">Done:{sessionCorrect}/{sessionTotal}</div>
  ),
}));

import StudyPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  searchParamsState.unit = "unitA";
  searchParamsState.mode = null;
  useSRSStore.setState({ cards: {}, streak: 0, lastStudiedDate: null, activeSession: null, introductions: {} });
});

afterEach(() => { cleanup(); });

describe("app/study/page.tsx — session-identity remount (Task #654 regression)", () => {
  it("shows the new unit's fresh queue, not the prior unit's stale completed session, after a same-pathname navigation", () => {
    const { rerender } = render(<StudyPage />);

    // Unit A's only card is showing.
    expect(screen.getByTestId("study-card")).toHaveAttribute("data-card-id", CARD_A1.id);

    // Rate it — completes unit A's 1-card session (pos becomes 1 === queue.length).
    fireEvent.click(screen.getByText("Rate good"));
    expect(screen.getByTestId("study-done")).toBeInTheDocument();

    // Query-string-only navigation to a different unit — Next.js App Router would NOT
    // unmount StudyInner here without the key fix; rerender() reproduces exactly that.
    searchParamsState.unit = "unitB";
    rerender(<StudyPage />);

    // Fixed behavior: a fresh session for unit B, not unit A's stale "done" screen.
    expect(screen.queryByTestId("study-done")).not.toBeInTheDocument();
    const studyCard = screen.getByTestId("study-card");
    expect(studyCard).toHaveAttribute("data-card-id", CARD_B1.id);
  });

  it("does not carry over the prior session's activeSession into the new unit's resumable-session check", () => {
    const { rerender } = render(<StudyPage />);
    fireEvent.click(screen.getByText("Rate good"));
    // Completing a 1-card session clears the active session (useStudySession.ts's own
    // pos>=queue.length effect) — confirmed here so the assertion below isn't vacuous.
    expect(useSRSStore.getState().activeSession).toBeNull();

    searchParamsState.unit = "unitB";
    rerender(<StudyPage />);

    // Unit B renders its real card immediately — no stray resume prompt from unit A's
    // (already-cleared) session leaking into unit B's resume-decision check.
    expect(screen.queryByTestId("study-resume")).not.toBeInTheDocument();
    expect(screen.getByTestId("study-card")).toHaveAttribute("data-card-id", CARD_B1.id);
  });
});
