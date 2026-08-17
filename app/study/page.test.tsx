// @vitest-environment jsdom
// ============================================================
// app/study/page.test.tsx — Behavioral tests for app/study/page.tsx (Task #112)
// ============================================================
// Covers: StudyCard renders first card in queue, StudyDoneScreen appears when
// session is done (pos >= queue.length), "Nothing ready" screen renders
// when buildQueue returns empty.
// ============================================================
// Strategy: mock useStudySession and buildQueue for full rendering control.
// The real SRS store is used with fresh state; @/lib/storage is no-op.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { useSRSStore } from "@/store/srsStore";
import { HYDRATION_STUCK_TIMEOUT_MS } from "@/hooks/useHydrationStuck";

// ── vi.hoisted: mutable state controlling mock return values ──────────────────

const { mockRouterPush, mockUseStudySession, mockBuildQueue } = vi.hoisted(() => ({
  mockRouterPush: vi.fn(),
  // Captures the exact args app/study/page.tsx passes into useStudySession() — lets tests
  // assert on the real `initialQueue` value the page computed, not just sessionCfg's
  // hardcoded return.
  mockUseStudySession: vi.fn(),
  // Captures/controls buildQueue's real input — the default beforeEach implementation
  // below ignores it (matching the original hardcoded mock) for existing tests; specific
  // tests (Task #552's cold-start regression) override this to be input-aware.
  mockBuildQueue: vi.fn(),
}));

// Controls what useSearchParams' "mode" param returns — mutable so individual tests can
// exercise isInterrupt/isGlobal branches without every other test needing to know about it.
const searchParamsState = vi.hoisted(() => ({ mode: "global" as string | null }));

// Task #628 (Wave 8): independently controls useIsHydrated (lenient) and
// useIsHydratedStrict — both default true so every pre-existing test (written before
// the strict gate existed) is unaffected; the dedicated regression test below sets
// hydrated=true/hydratedStrict=false to prove the interactive UI stays blocked.
const hydrationState = vi.hoisted(() => ({ hydrated: true, hydratedStrict: true }));

// Controls what buildQueue returns for each test
const builtQueue = vi.hoisted(() => ({
  cards: [] as Array<{
    id: string; tier: number; type: string; prompt: string;
    accepted: string[]; tags: string[]; deprecated?: boolean;
  }>,
}));

// Controls useStudySession return value for each test
const sessionCfg = vi.hoisted(() => ({
  queue: [] as typeof builtQueue.cards,
  pos: 0,
  sessionCorrect: 0,
  sessionTotal: 0,
  resumeDecision: "declined" as string,
  setResumeDecision: vi.fn(),
  handleRate: vi.fn(),
  resetToQueue: vi.fn(),
}));

// ── next/navigation ───────────────────────────────────────────────────────────
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush, replace: vi.fn() }),
  useSearchParams: () => ({ get: (k: string) => (k === "mode" ? searchParamsState.mode : null) }),
}));

// ── @/hooks/useLangPack — return empty (initialQueue controlled via buildQueue) ─
// `lang` is a distinct-from-default fixture (not lib/language's ITALIAN) specifically so
// Test 4 below can prove the real useLangPack() lang value reaches StudyCard, rather than
// StudyCard happening to render correctly via some hardcoded fallback that would mask a
// regression in the app/study/page.tsx -> StudyCard prop-threading (Task: multi-language
// architecture prep).
const mockLangConfig = vi.hoisted(() => ({
  code: "xx-test",
  name: "Test Language",
  nativeName: "Test Language",
  flag: "🧪",
  articles: null,
  diacriticTolerant: false,
  uiStrings: {
    appTitle: "plyglt",
    appSubtitle: "test",
    correctFeedback: "Correct.",
    closeFeedback: "Close.",
    cardLabels: {
      produce: "Type",
      recognize: "Translate",
      conjugate: "Conjugate",
      fill_blank: "Fill in",
      passage_cloze: "Read",
    },
    curriculumCredit: "Test",
  },
}));
// Mutable so tests can simulate a pack still loading (units/unitMap empty, loading:true)
// transitioning to loaded (Task #553) — the real hook this mocks reflects live pack state,
// not a value frozen for the component's whole lifetime.
const langPackState = vi.hoisted(() => ({
  units: [] as Array<{ id: string; cards: unknown[]; prerequisiteUnits?: string[] }>,
  unitMap: {} as Record<string, unknown>,
  loading: false,
}));
vi.mock("@/hooks/useLangPack", () => ({
  useLangPack: () => ({ units: langPackState.units, unitMap: langPackState.unitMap, lang: mockLangConfig, loading: langPackState.loading }),
}));

// ── @/lib/queue — buildQueue returns builtQueue.cards by default; input-aware override
// available per-test via mockBuildQueue.mockImplementation(...) ─────────────────────
vi.mock("@/lib/queue", async () => {
  // Task #557: import the REAL INTERRUPT_SESSION_CAP rather than hardcoding a literal 8 —
  // a future change to the real constant in lib/queue.ts must be caught by this test file,
  // not silently diverge from it.
  const actual = await vi.importActual<typeof import("@/lib/queue")>("@/lib/queue");
  return {
    buildQueue: (...args: unknown[]) => mockBuildQueue(...args),
    findUnitName: () => "Test Unit",
    INTERRUPT_SESSION_CAP: actual.INTERRUPT_SESSION_CAP,
  };
});

// ── @/hooks/useStudySession — controlled per-test via sessionCfg; args captured
// via mockUseStudySession for tests that need to inspect the real initialQueue passed in ─
vi.mock("@/hooks/useStudySession", () => ({
  useStudySession: (...args: unknown[]) => {
    mockUseStudySession(...args);
    return sessionCfg;
  },
}));

// ── @/lib/storage — no-op storage + useIsHydrated/useIsHydratedStrict always true ──
// Task #628 (Wave 8): page.tsx now also gates on useIsHydratedStrict — must be
// mocked too, or every render throws (no export defined on the mock).
vi.mock("@/lib/storage", () => ({
  createPlatformStorage: () => ({
    getItem:    vi.fn().mockResolvedValue(null),
    setItem:    vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  }),
  useIsHydrated: () => hydrationState.hydrated,
  useIsHydratedStrict: () => hydrationState.hydratedStrict,
}));

// ── @/lib/tauri — no-op for all Tauri APIs ────────────────────────────────────
vi.mock("@/lib/tauri", () => ({
  isTauri: false,
  invoke: vi.fn(),
  listen: vi.fn().mockResolvedValue(() => {}),
  exitMandatoryMode: vi.fn().mockResolvedValue(undefined),
  snoozeInterrupt: vi.fn().mockResolvedValue(undefined),
  updateTrayBadge: vi.fn(),
  openExternalUrl: vi.fn(),
}));

// ── @/lib/entitlement — constants only ───────────────────────────────────────
vi.mock("@/lib/entitlement", () => ({
  CHECKOUT_URLS: { annual: "https://pay.example.com/annual" },
  CUSTOMER_PORTAL_URL: "https://pay.example.com/portal",
  PRICING: { annual: "$34.99/yr" },
}));

// ── @tauri-apps/plugin-store — safety net ─────────────────────────────────────
vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn().mockResolvedValue({
    get:     vi.fn().mockResolvedValue(undefined),
    set:     vi.fn().mockResolvedValue(undefined),
    save:    vi.fn().mockResolvedValue(undefined),
    has:     vi.fn().mockResolvedValue(false),
    delete:  vi.fn().mockResolvedValue(undefined),
    entries: vi.fn().mockResolvedValue([]),
    keys:    vi.fn().mockResolvedValue([]),
  }),
}));

// ── @/components/StudyCard — test double ─────────────────────────────────────
vi.mock("@/components/StudyCard", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: ({ card, lang }: any) => (
    <div data-testid="study-card" data-lang-code={lang?.code}>StudyCard:{card.id}</div>
  ),
}));

// ── @/components/StudyDoneScreen — test double ───────────────────────────────
// Renders onStudyMore's presence (not just invokes it) so tests can assert whether the
// page offered a "Study more" callback at all — Task #569's regression is specifically
// that this was truthy in interrupt mode when it should be null. Also renders a real
// button wired to onStudyMore (Task #600) so tests can actually trigger the callback,
// not just observe its presence/absence.
vi.mock("@/components/StudyDoneScreen", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: ({ sessionCorrect, sessionTotal, onStudyMore }: any) => (
    <div data-testid="study-done" data-has-study-more={onStudyMore != null}>
      Done:{sessionCorrect}/{sessionTotal}
      {onStudyMore && <button onClick={onStudyMore}>Study more</button>}
    </div>
  ),
}));

// ── @/components/StudyResumePrompt — test double ─────────────────────────────
vi.mock("@/components/StudyResumePrompt", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: ({ onDecline }: any) => (
    <div data-testid="study-resume">
      <button onClick={onDecline}>Decline</button>
    </div>
  ),
}));

// Import the component under test after all mocks are registered
import StudyPage from "./page";

// ── Fake card matching Card interface ─────────────────────────────────────────

const FAKE_CARD = {
  id: "test-card-001",
  type: "recognize" as const,
  prompt: "ciao",
  accepted: ["hello"],
  tags: ["greeting"],
  tier: 1 as const,
  deprecated: false,
};

// Task #590/#600: exercises real "unit" mode (mode=null, neither global nor interrupt) —
// no prior test in this file did. The useSearchParams mock above only special-cases the
// "mode" key and always returns null for "unit", so unitId is always "" — this fixture is
// keyed under langPackState.unitMap[""] to match.
const FAKE_UNIT = {
  id: "",
  name: "Fake Unit",
  emoji: "📘",
  cards: [FAKE_CARD],
  prerequisiteUnits: [] as string[],
};

// ── Reset helpers ─────────────────────────────────────────────────────────────

function setCards(cards: typeof FAKE_CARD[]) {
  builtQueue.cards = cards;
  sessionCfg.queue = cards;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockBuildQueue.mockImplementation(() => builtQueue.cards);
  sessionCfg.pos = 0;
  sessionCfg.sessionCorrect = 0;
  sessionCfg.sessionTotal = 0;
  sessionCfg.resumeDecision = "declined";
  searchParamsState.mode = "global";
  hydrationState.hydrated = true;
  hydrationState.hydratedStrict = true;
  langPackState.units = [];
  langPackState.unitMap = {};
  langPackState.loading = false;
  setCards([]);
});

afterEach(() => { cleanup(); });

// ─────────────────────────────────────────────────────────────────────────────

describe("StudyPage — app/study/page.tsx", () => {
  // Test 1: StudyCard renders the first card in the queue
  it("renders StudyCard for the current card when the queue has cards and pos is 0", () => {
    setCards([FAKE_CARD]);
    sessionCfg.pos = 0; // pos < queue.length → not done

    render(<StudyPage />);

    const studyCard = screen.getByTestId("study-card");
    expect(studyCard).toBeInTheDocument();
    expect(studyCard).toHaveTextContent("StudyCard:test-card-001");
  });

  // Test 1b: useLangPack()'s `lang` reaches StudyCard as a prop — not a hardcoded
  // default. B7 target: deleting the `lang={lang}` prop (or the `lang` destructure) on
  // the <StudyCard> render call in app/study/page.tsx makes this fail, since the mocked
  // useLangPack() above returns a distinct fixture (code "xx-test") that no real
  // LanguageConfig constant shares.
  it("passes useLangPack()'s lang value through to StudyCard, not a hardcoded default", () => {
    setCards([FAKE_CARD]);
    sessionCfg.pos = 0;

    render(<StudyPage />);

    expect(screen.getByTestId("study-card")).toHaveAttribute("data-lang-code", "xx-test");
  });

  // Test 2: StudyDoneScreen appears when pos >= queue.length (done state)
  it("renders StudyDoneScreen when pos is at or past the end of the queue", () => {
    setCards([FAKE_CARD]);
    sessionCfg.pos = 1; // pos === queue.length → done

    render(<StudyPage />);

    expect(screen.getByTestId("study-done")).toBeInTheDocument();
    expect(screen.queryByTestId("study-card")).not.toBeInTheDocument();
  });

  // Test 3: "Nothing ready" screen renders when buildQueue returns empty
  it("renders 'Nothing ready' when buildQueue returns an empty queue", () => {
    setCards([]); // empty — initialQueue.length === 0

    render(<StudyPage />);

    expect(screen.getByText("Nothing ready.")).toBeInTheDocument();
    expect(screen.queryByTestId("study-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("study-done")).not.toBeInTheDocument();
  });

  // Round-7 audit finding (severity 8, Agent W "F-NEW-1"): the empty-queue check
  // used to run BEFORE the pending-resume check. hooks/useStudySession.ts's
  // mount-fill effect deliberately skips filling the queue while a resumable
  // session is pending (Task #629) — on a caught-up day with an empty
  // initialQueue AND a pending resumable session (interrupt sessions all key on
  // unitId="", so any incomplete prior interrupt session matches any subsequent
  // one), queue.length === 0 and resumeDecision === "pending" were both true at
  // once. The old ordering showed "Nothing ready" and permanently hid the resume
  // prompt — StudyEmptyQueue's Home button never clears the stale session, so
  // the trap persisted for up to SESSION_EXPIRY_MS (24h). Deletion Test:
  // reverting the reorder in app/study/page.tsx (checking queue.length === 0
  // before resumeDecision === "pending" again) makes this test fail — "Nothing
  // ready." would render instead of the resume prompt.
  it("shows the resume prompt, not 'Nothing ready', when the queue is empty and a resume decision is pending", () => {
    setCards([]); // empty queue — the mount-fill effect skipped filling while pending
    sessionCfg.resumeDecision = "pending";

    render(<StudyPage />);

    expect(screen.getByTestId("study-resume")).toBeInTheDocument();
    expect(screen.queryByText("Nothing ready.")).not.toBeInTheDocument();
  });

  // Interrupt-floor flex fallback (BRAND.md: 6-10 interrupts/day, never fewer). The mocked
  // buildQueue (builtQueue.cards) simulates an empty initialQueue — the same starting state
  // useStudySession's mount effect sees before it performs the flex introduction — while
  // sessionCfg.queue simulates the hook's live queue AFTER that fallback ran and appended a
  // card. Deletion Test: reverting the page's guard to check initialQueue.length instead of
  // queue.length makes this render "Nothing ready." even though the hook already has content.
  it("renders StudyCard, not 'Nothing ready', when initialQueue is empty but the hook's live queue has a flex-introduced card", () => {
    builtQueue.cards = []; // initialQueue starts empty
    sessionCfg.queue = [FAKE_CARD]; // ...but useStudySession's mount-effect flex fallback added one
    sessionCfg.pos = 0;

    render(<StudyPage />);

    expect(screen.getByTestId("study-card")).toBeInTheDocument();
    expect(screen.queryByText("Nothing ready.")).not.toBeInTheDocument();
  });

  // Live Windows VM finding (2026-08-12): completing an interrupt-mode session crashed the
  // whole page with an uncaught "Cannot read properties of null (reading 'cards')" — the
  // WebView reported this as "This page couldn't load". Root cause: the isDone branch's
  // `unitCards` computation only checked `isGlobal`, but `unit` is null in BOTH isGlobal
  // and isInterrupt mode (line 49) — `unit!.cards` threw whenever an interrupt session (not
  // a global one) reached completion. The whole existing suite above ran with useSearchParams
  // hardcoded to mode=global, so isInterrupt was structurally never exercised and this was
  // unreachable in tests. This test fails (throws during render) without the fix.
  it("renders StudyDoneScreen — not a crash — when an interrupt-mode session completes", () => {
    searchParamsState.mode = "interrupt";
    setCards([FAKE_CARD]);
    sessionCfg.pos = 1; // pos === queue.length → done

    render(<StudyPage />);

    expect(screen.getByTestId("study-done")).toBeInTheDocument();
    expect(screen.queryByTestId("study-card")).not.toBeInTheDocument();
  });

  // Task #569: onStudyMore was previously gated only on !isGlobal, which is also true for
  // isInterrupt sessions — an interrupt session's `allCards` is the full cross-unit catalog,
  // and the rebuilt queue this callback triggers had no INTERRUPT_SESSION_CAP slice applied,
  // unlike initialQueue's own construction. Deletion Test: reverting the `!isGlobal &&
  // !isInterrupt` guard back to `!isGlobal` alone makes this test fail (onStudyMore would be
  // present, not null, for an interrupt-mode done screen). See the dedicated "onStudyMore
  // gating (Task #590)" describe block below for direct coverage of the global-mode-null and
  // unit-mode-non-null cases this comment used to (incorrectly) claim were already proven by
  // the sibling "renders StudyDoneScreen..." test above — that test never checked the
  // has-study-more attribute at all.
  it("does not offer 'Study more' when an interrupt-mode session completes", () => {
    searchParamsState.mode = "interrupt";
    setCards([FAKE_CARD]);
    sessionCfg.pos = 1; // done

    render(<StudyPage />);
    expect(screen.getByTestId("study-done")).toHaveAttribute("data-has-study-more", "false");
  });

  // Task #590: neither the global-mode-null nor the unit-mode-non-null case for onStudyMore
  // had any direct test coverage — a comment near the interrupt-mode test above incorrectly
  // claimed the global case was already proven by a sibling test that never checked the
  // has-study-more attribute. These two tests close that gap directly.
  describe("onStudyMore gating (Task #590)", () => {
    it("does not offer 'Study more' when a global session completes", () => {
      searchParamsState.mode = "global";
      setCards([FAKE_CARD]);
      sessionCfg.pos = 1; // done

      render(<StudyPage />);
      expect(screen.getByTestId("study-done")).toHaveAttribute("data-has-study-more", "false");
    });

    it("offers 'Study more' when a unit-mode session completes", () => {
      searchParamsState.mode = null; // neither global nor interrupt
      langPackState.unitMap = { "": FAKE_UNIT };
      setCards([FAKE_CARD]);
      sessionCfg.pos = 1; // done

      render(<StudyPage />);
      expect(screen.getByTestId("study-done")).toHaveAttribute("data-has-study-more", "true");
    });
  });

  // Task #600 (severity 6): the Study More handler's buildQueue call omitted the
  // getIntroductionDueCardIds parameter that initialQueue's own construction passes — a card
  // mid-intensive-introduction-phase due today would be silently excluded from a rebuilt
  // Study More queue even though the same unit's initial session load would have included it.
  // Deletion Test: reverting the fix (dropping the 5th buildQueue argument in the Study More
  // handler) makes this test fail — resetToQueue would be called with an empty array instead
  // of the introduction-due card, since only getIntroductionDueCardIds (overridden below)
  // supplies it in this test's setup.
  it("includes an introduction-cadence-due card when Study More rebuilds the queue (regression, Task #600)", () => {
    const originalGetIntroductionDueCardIds = useSRSStore.getState().getIntroductionDueCardIds;
    const introDueCard = { ...FAKE_CARD, id: "intro-due-card-001" };
    try {
      searchParamsState.mode = null; // unit mode — required for onStudyMore to be offered
      langPackState.unitMap = { "": FAKE_UNIT };
      // Real srsStore is used in this file (see header comment) — overriding just this one
      // action mirrors the brief's "mock getIntroductionDueCardIds to return a card id"
      // instruction without reconstructing real introduction-engine timing state.
      useSRSStore.setState({ getIntroductionDueCardIds: () => [introDueCard.id] });
      // Pass-through implementation (not the default builtQueue.cards stand-in) — echoes
      // back whichever ids the REAL getIntroductionDueCardIds reference resolves to, so the
      // test proves the function was actually passed through to buildQueue, not merely that
      // resetToQueue was called with some hardcoded value.
      mockBuildQueue.mockImplementation((_cards, _getDueCards, _getNewCards, _globalMode, getIntroductionDueCardIds) => {
        const ids: string[] = getIntroductionDueCardIds ? getIntroductionDueCardIds("2026-08-15") : [];
        return ids.includes(introDueCard.id) ? [introDueCard] : [];
      });
      setCards([FAKE_CARD]);
      sessionCfg.pos = 1; // done — StudyDoneScreen renders with onStudyMore

      render(<StudyPage />);
      fireEvent.click(screen.getByText("Study more"));

      expect(sessionCfg.resetToQueue).toHaveBeenCalledWith([introDueCard]);
    } finally {
      useSRSStore.setState({ getIntroductionDueCardIds: originalGetIntroductionDueCardIds });
    }
  });

  // Task #552: initialQueue's useMemo previously omitted `allCards` from its dependency
  // array — on a cold start where the pack (ALL_UNITS) is still loading when the page first
  // renders, `initialQueue` could freeze at [] and never recompute once the pack finished
  // loading, permanently defeating the never-empty-queue guarantee (most plausible via a
  // push-tap cold start, hooks/usePushInterruptTap.ts). Deletion Test: removing `allCards`
  // from the memo's deps (reverting the #552 fix) makes this test fail — the second render's
  // captured initialQueue would still be [] instead of reflecting the newly loaded card.
  it("recomputes initialQueue once the pack finishes loading after a cold-start render", () => {
    // buildQueue pass-through (not the default builtQueue.cards stand-in) — echoing back
    // its `allCards` input directly so the test can prove the memo actually re-ran with the
    // new allCards value, not just that *some* recompute happened to occur.
    mockBuildQueue.mockImplementation((cards: unknown[]) => cards);
    langPackState.loading = true;
    langPackState.units = []; // pack still loading — allCards is []

    const { rerender } = render(<StudyPage />);

    expect(mockUseStudySession).toHaveBeenCalledTimes(1);
    expect(mockUseStudySession.mock.calls[0]![0].initialQueue).toEqual([]);

    // Pack finishes loading — ALL_UNITS populates with a real card.
    langPackState.loading = false;
    langPackState.units = [{ id: "u1", cards: [FAKE_CARD] }];
    rerender(<StudyPage />);

    const lastCallArgs = mockUseStudySession.mock.calls[mockUseStudySession.mock.calls.length - 1]![0];
    expect(lastCallArgs.initialQueue).toEqual([FAKE_CARD]);
  });

  // Task #553: the useLangPack mock previously hardcoded loading:false in every test, so no
  // test in this file could catch a pack-loading-race regression (Task #552) at the rendered-
  // output level — only at the internal initialQueue-value level (the test above). This test
  // proves the page itself transitions correctly: it must show the loading screen (never
  // "Nothing ready.", which would misleadingly suggest no cards will ever be available) while
  // the pack is still loading, then render the real queue once loading completes.
  it("shows the loading screen while the pack is still loading, then the real queue once it finishes", () => {
    langPackState.loading = true;
    setCards([FAKE_CARD]);
    sessionCfg.pos = 0;

    const { rerender } = render(<StudyPage />);

    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByTestId("study-card")).not.toBeInTheDocument();
    expect(screen.queryByText("Nothing ready.")).not.toBeInTheDocument();

    langPackState.loading = false;
    rerender(<StudyPage />);

    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
    expect(screen.getByTestId("study-card")).toBeInTheDocument();
  });

  // Task #557: no prior test exercised the real INTERRUPT_SESSION_CAP=8 slicing behavior in
  // app/study/page.tsx's initialQueue memo — only a mock constant existed, with nothing
  // asserting the actual cap fires against an oversized queue. Deletion Test: removing the
  // `full.slice(0, INTERRUPT_SESSION_CAP)` call (returning `full` uncapped instead) makes
  // this test fail — initialQueue would be 10 cards, not 8.
  it("caps an oversized interrupt-mode queue at exactly INTERRUPT_SESSION_CAP (8) cards", () => {
    searchParamsState.mode = "interrupt";
    const oversizedQueue = Array.from({ length: 10 }, (_, i) => ({ ...FAKE_CARD, id: `card-${i}` }));
    mockBuildQueue.mockImplementation(() => oversizedQueue);
    sessionCfg.pos = 0;

    render(<StudyPage />);

    expect(mockUseStudySession).toHaveBeenCalledTimes(1);
    const initialQueue = mockUseStudySession.mock.calls[0]![0].initialQueue;
    expect(initialQueue).toHaveLength(8);
    expect(initialQueue).toEqual(oversizedQueue.slice(0, 8));
  });

  // Task #628 (Wave 8): the lenient useIsHydrated resolves true via
  // HYDRATION_FAILSAFE_MS even when real hydration never finishes — but everything
  // past that gate is the interactive, write-capable study UI (handleRate →
  // commitSession; onRate → recordIntroductionResult). A user must never reach that
  // UI (and therefore never be able to trigger a write) before real hydration
  // completes, even after the failsafe has elapsed and the lenient gate has opened.
  describe("hydration gating (Task #628) — interactive UI stays blocked until real hydration completes", () => {
    it("does not render the interactive study UI when the failsafe has elapsed (useIsHydrated=true) but real hydration has not finished (useIsHydratedStrict=false)", () => {
      setCards([FAKE_CARD]);
      sessionCfg.pos = 0; // would render StudyCard if reached
      hydrationState.hydrated = true; // failsafe already elapsed — lenient gate open
      hydrationState.hydratedStrict = false; // real hydration still pending

      render(<StudyPage />);

      // Deletion Test: gating only on `hydrated` (the pre-#628 shape) would render
      // StudyCard here — the exact reachability path that put a real rating write
      // inside the failsafe window lib/storage.ts's Task #627 collision fix protects
      // against.
      // useStudySession is an unconditional hook call (runs every render before the
      // early return per Rules of Hooks) — the gate gets checked, not the hook call.
      expect(screen.getByText("Loading…")).toBeInTheDocument();
      expect(screen.queryByTestId("study-card")).not.toBeInTheDocument();
    });

    it("renders the interactive study UI once real hydration completes (both gates true)", () => {
      setCards([FAKE_CARD]);
      sessionCfg.pos = 0;
      hydrationState.hydrated = true;
      hydrationState.hydratedStrict = true;

      render(<StudyPage />);

      expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
      expect(screen.getByTestId("study-card")).toBeInTheDocument();
    });

    // Task #644: hydratedStrict never resolves via a failsafe by design (that's
    // what makes it safe to write-gate on) — so a genuine hydration failure must
    // surface a retry affordance instead of hanging on "Loading…" forever.
    // Round-9 audit finding (Agent A / Agent W / Agent K, 3-way convergent, Rule
    // 18): the round-8 version of this test only advanced timers by a hardcoded
    // 45000ms and asserted the end state — it would pass identically whatever
    // HYDRATION_STUCK_TIMEOUT_MS actually is (confirmed via a live Deletion Test:
    // reverting the exported constant back to 15000ms left this test green).
    // Rewritten to import the real constant and assert BOTH sides of its
    // boundary, so a future accidental change to the exported value is caught.
    it("shows a retry screen instead of Loading… once real hydration has stayed stuck past the bounded timeout", () => {
      vi.useFakeTimers();
      setCards([FAKE_CARD]);
      sessionCfg.pos = 0;
      hydrationState.hydrated = true;
      hydrationState.hydratedStrict = false;

      render(<StudyPage />);
      expect(screen.getByText("Loading…")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(HYDRATION_STUCK_TIMEOUT_MS - 1);
      });
      // Deletion Test: reverting HYDRATION_STUCK_TIMEOUT_MS to any value below
      // its real current value makes this assertion fail (the retry screen would
      // already be showing here instead of "Loading…").
      expect(screen.getByText("Loading…")).toBeInTheDocument();
      expect(screen.queryByText("Couldn't load your progress.")).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
      expect(screen.getByText("Couldn't load your progress.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
      vi.useRealTimers();
    });

    // Round-8 audit finding (Agent B): the round-7 F012 fix (useHydrationStuck
    // generalized to a composite `blocked` parameter) had a unit test proving the
    // HOOK tracks whatever boolean it's given, but nothing proved the page-level
    // WIRING — that app/study/page.tsx actually passes the full stillLoading
    // composite, not just !hydratedStrict, to the hook. Agent B confirmed this
    // gap concretely: reverting the wiring to the old, narrower
    // useHydrationStuck(!hydratedStrict) call left the full 2024-test suite green.
    // This test exercises the exact scenario F012 was written to fix: hydration
    // itself resolves, but the pack is still loading.
    it("shows the retry screen when packLoading alone is what stays stuck, even though hydratedStrict has already resolved", () => {
      vi.useFakeTimers();
      setCards([FAKE_CARD]);
      sessionCfg.pos = 0;
      hydrationState.hydrated = true;
      hydrationState.hydratedStrict = true; // hydration itself is fine...
      langPackState.loading = true; // ...but the pack fetch is the one still stuck

      render(<StudyPage />);
      expect(screen.getByText("Loading…")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(HYDRATION_STUCK_TIMEOUT_MS);
      });

      // Deletion Test: reverting app/study/page.tsx's wiring to
      // useHydrationStuck(!hydratedStrict) (ignoring packLoading) would leave
      // hydrationStuck permanently false here (!hydratedStrict is false the whole
      // time), so this assertion fails and "Loading…" stays shown forever instead.
      expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
      expect(screen.getByText("Couldn't load your progress.")).toBeInTheDocument();
      vi.useRealTimers();
    });
  });
});
