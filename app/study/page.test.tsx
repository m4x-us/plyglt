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
import { render, screen, cleanup } from "@testing-library/react";

// ── vi.hoisted: mutable state controlling mock return values ──────────────────

const { mockRouterPush } = vi.hoisted(() => ({ mockRouterPush: vi.fn() }));

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
  useSearchParams: () => ({ get: (k: string) => (k === "mode" ? "global" : null) }),
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
vi.mock("@/hooks/useLangPack", () => ({
  useLangPack: () => ({ units: [], unitMap: {}, lang: mockLangConfig, loading: false }),
}));

// ── @/lib/queue — buildQueue returns builtQueue.cards ────────────────────────
vi.mock("@/lib/queue", () => ({
  buildQueue: () => builtQueue.cards,
  findUnitName: () => "Test Unit",
}));

// ── @/hooks/useStudySession — controlled per-test via sessionCfg ─────────────
vi.mock("@/hooks/useStudySession", () => ({
  useStudySession: () => sessionCfg,
}));

// ── @/lib/storage — no-op storage + useIsHydrated always true ─────────────────
vi.mock("@/lib/storage", () => ({
  createPlatformStorage: () => ({
    getItem:    vi.fn().mockResolvedValue(null),
    setItem:    vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  }),
  useIsHydrated: () => true,
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
vi.mock("@/components/StudyDoneScreen", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: ({ sessionCorrect, sessionTotal }: any) => (
    <div data-testid="study-done">Done:{sessionCorrect}/{sessionTotal}</div>
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

// ── Reset helpers ─────────────────────────────────────────────────────────────

function setCards(cards: typeof FAKE_CARD[]) {
  builtQueue.cards = cards;
  sessionCfg.queue = cards;
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionCfg.pos = 0;
  sessionCfg.sessionCorrect = 0;
  sessionCfg.sessionTotal = 0;
  sessionCfg.resumeDecision = "declined";
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
});
