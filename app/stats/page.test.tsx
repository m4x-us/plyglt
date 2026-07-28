// ============================================================
// page.test.tsx — Behavioral tests for app/stats/page.tsx (StatsPage)
// ============================================================
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/components/DifficultyBar", () => ({
  default: ({ value }: { value: number }) => (
    <span data-testid="difficulty">{value}</span>
  ),
  // Task #444: wrapped in vi.fn() (not a plain arrow function) so a test can override its
  // implementation with the real stabilityColorClass to exercise the actual color-threshold
  // logic, then restore the hardcoded default afterward.
  stabilityColorClass: vi.fn(() => "text-green-400"),
}));

vi.mock("@/hooks/useStatsData", () => ({
  useStatsData: vi.fn(),
}));

// next/link renders as <a> in jsdom — no explicit mock needed
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

// Default: Pro user, analytics flag on, no expiry — existing tests see full stats page.
vi.mock("@/store/entitlementStore", () => ({
  useEntitlementStore: vi.fn(() => ({ licenseType: "subscription" as const, validUntil: null as number | null })),
}));

const STATS_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // mirrors lib/featureFlags.ts SUBSCRIPTION_GRACE_PERIOD_MS
vi.mock("@/lib/featureFlags", () => ({
  getFeatureFlags: vi.fn(() => ({ analytics: true, interruptEngine: true, vacationMode: true, specialtyPacks: true })),
  // Task #420: mirrors the real isProEnabled's expiry check so this mock's behavior stays
  // representative of production rather than silently drifting once the real fn changed.
  isProEnabled: vi.fn((flag: boolean, licenseType: string, validUntil: number | null) => {
    if (!flag || licenseType !== "subscription") return false;
    if (validUntil !== null && Date.now() > validUntil + STATS_GRACE_PERIOD_MS) return false;
    return true;
  }),
}));

import { useStatsData } from "@/hooks/useStatsData";
import { useEntitlementStore } from "@/store/entitlementStore";
import { getFeatureFlags } from "@/lib/featureFlags";
import { stabilityColorClass } from "@/components/DifficultyBar";
import StatsPage from "./page";

function makeCardWithProgress(id: string, prompt: string, difficulty: number) {
  return {
    card: {
      id,
      type: "recognize" as const,
      prompt,
      accepted: [],
      tags: [],
      tier: 1 as const,
    },
    progress: {
      cardId: id,
      state: "review" as const,
      stability: 10,
      difficulty,
      retrievability: 0.8,
      dueDate: Date.now() + 86400000,
      lapses: 0,
      reps: 5,
    },
  };
}

function makeAtRisk(prompt: string, daysAgo: number, now: number) {
  return {
    card: {
      id: `card-${prompt}`,
      type: "recognize" as const,
      prompt,
      accepted: [],
      tags: [],
      tier: 1 as const,
    },
    progress: {
      cardId: `card-${prompt}`,
      state: "review" as const,
      stability: 5,
      difficulty: 7,
      retrievability: 0.5,
      dueDate: now - daysAgo * 86400000,
      lapses: 1,
      reps: 5,
    },
  };
}

const EMPTY_STATS = {
  loading: false,
  seen: 0,
  totalCards: 100,
  now: Date.now(),
  hardest: [],
  weakestTags: [],
  levelStability: [],
  atRisk: [],
};

afterEach(cleanup);

describe("app/stats/page.tsx — StatsPage", () => {
  it("renders a loading indicator while useStatsData is still loading", () => {
    vi.mocked(useStatsData).mockReturnValue({ ...EMPTY_STATS, loading: true });
    render(<StatsPage />);
    screen.getByText("Loading…");
  });

  it("renders empty state when no cards have been studied", () => {
    vi.mocked(useStatsData).mockReturnValue(EMPTY_STATS);
    render(<StatsPage />);
    screen.getByText("Start studying to see your stats here.");
  });

  it("renders 'last seen Nd ago' framing for at-risk cards — regression guard (Task #088)", () => {
    const now = Date.now();
    vi.mocked(useStatsData).mockReturnValue({
      ...EMPTY_STATS,
      seen: 10,
      now,
      atRisk: [makeAtRisk("gatto", 8, now)],
    });
    render(<StatsPage />);

    // Must show "last seen Nd ago" — not bare "Nd ago"
    screen.getByText(/last seen \d+d ago/);

    // Regression guard: every "d ago" occurrence must be preceded by "last seen"
    const allText = document.body.textContent ?? "";
    const totalDago = (allText.match(/\d+d ago/g) ?? []).length;
    const lastSeenDago = (allText.match(/last seen \d+d ago/g) ?? []).length;
    expect(lastSeenDago).toBe(totalDago);
  });

  // ── Analytics gate (Task #155) ────────────────────────────────────────────

  it("shows upgrade prompt for free users — analytics gate blocks access", () => {
    vi.mocked(useEntitlementStore).mockReturnValue({ licenseType: "free" } as ReturnType<typeof useEntitlementStore>);
    vi.mocked(getFeatureFlags).mockReturnValue({ analytics: true, interruptEngine: true, vacationMode: true, specialtyPacks: true });
    vi.mocked(useStatsData).mockReturnValue(EMPTY_STATS);
    render(<StatsPage />);
    screen.getByText("Detailed analytics are a Pro feature.");
    expect(screen.queryByText("Start studying to see your stats here.")).toBeNull();
  });

  it("shows full stats page for Pro users — analytics gate passes", () => {
    vi.mocked(useEntitlementStore).mockReturnValue({ licenseType: "subscription" } as ReturnType<typeof useEntitlementStore>);
    vi.mocked(getFeatureFlags).mockReturnValue({ analytics: true, interruptEngine: true, vacationMode: true, specialtyPacks: true });
    vi.mocked(useStatsData).mockReturnValue(EMPTY_STATS);
    render(<StatsPage />);
    expect(screen.queryByText("Detailed analytics are a Pro feature.")).toBeNull();
    screen.getByText("Start studying to see your stats here.");
  });

  it("shows upgrade prompt when analytics flag is disabled — blocks even Pro users", () => {
    vi.mocked(useEntitlementStore).mockReturnValue({ licenseType: "subscription" } as ReturnType<typeof useEntitlementStore>);
    vi.mocked(getFeatureFlags).mockReturnValue({ analytics: false, interruptEngine: true, vacationMode: true, specialtyPacks: true });
    vi.mocked(useStatsData).mockReturnValue(EMPTY_STATS);
    render(<StatsPage />);
    screen.getByText("Detailed analytics are a Pro feature.");
    expect(screen.queryByText("Start studying to see your stats here.")).toBeNull();
  });

  // Task #420: isProEnabled became expiry-aware — a lapsed subscriber past validUntil +
  // grace period must be denied here too, matching isPackUnlocked's identical policy.
  it("#420: shows upgrade prompt for a subscription past validUntil + grace period, even with licenseType still \"subscription\"", () => {
    vi.mocked(useEntitlementStore).mockReturnValue({
      licenseType: "subscription",
      validUntil: Date.now() - STATS_GRACE_PERIOD_MS - 1,
    } as ReturnType<typeof useEntitlementStore>);
    vi.mocked(getFeatureFlags).mockReturnValue({ analytics: true, interruptEngine: true, vacationMode: true, specialtyPacks: true });
    vi.mocked(useStatsData).mockReturnValue(EMPTY_STATS);
    render(<StatsPage />);
    screen.getByText("Detailed analytics are a Pro feature.");
    expect(screen.queryByText("Start studying to see your stats here.")).toBeNull();
  });

  it("#420: shows full stats page for a subscription within the grace period past validUntil", () => {
    vi.mocked(useEntitlementStore).mockReturnValue({
      licenseType: "subscription",
      validUntil: Date.now() - STATS_GRACE_PERIOD_MS + 60_000,
    } as ReturnType<typeof useEntitlementStore>);
    vi.mocked(getFeatureFlags).mockReturnValue({ analytics: true, interruptEngine: true, vacationMode: true, specialtyPacks: true });
    vi.mocked(useStatsData).mockReturnValue(EMPTY_STATS);
    render(<StatsPage />);
    expect(screen.queryByText("Detailed analytics are a Pro feature.")).toBeNull();
    screen.getByText("Start studying to see your stats here.");
  });

  // ── Task #444 (F014): populated-dashboard happy path ──────────────────────
  // Every test above drives the page with EMPTY_STATS or a Pro-gate-blocked state — none
  // of them ever populate hardest/weakestTags/levelStability, so lines 86-126 (the
  // DifficultyBar-rendering branch, the weakestTags block, and the levelStability
  // retention-bars block including stabilityColorClass and its width-percentage
  // calculation) never execute under test.
  it("#444: populated dashboard renders hardest cards, weakest topics, and retention bars with real content", async () => {
    // Override the module-level stabilityColorClass mock with the REAL implementation
    // for this test only — the mock elsewhere in this file hardcodes "text-green-400"
    // regardless of input, which would hide a regression in how the page wires the
    // median stability value into the real color-threshold logic.
    const actual = await vi.importActual<typeof import("@/components/DifficultyBar")>(
      "@/components/DifficultyBar"
    );
    vi.mocked(stabilityColorClass).mockImplementation(actual.stabilityColorClass);

    try {
      vi.mocked(useStatsData).mockReturnValue({
        loading: false,
        seen: 42,
        totalCards: 100,
        now: Date.now(),
        hardest: [
          makeCardWithProgress("c1", "correre", 8.4),
          makeCardWithProgress("c2", "mangiare", 3.1),
        ],
        weakestTags: [
          { tag: "verbs", avgDifficulty: 7.2, count: 5 },
          { tag: "food", avgDifficulty: 4.5, count: 3 },
        ],
        levelStability: [
          { level: "A1", median: 90, count: 12 }, // width clamps to 100% (150% raw); green
          { level: "A2", median: 12, count: 4 },   // 20% width; yellow
          { level: "B1", median: 3, count: 2 },    // 5% width; red
          { level: "B2", median: 0, count: 0 },    // "No mastered cards"; red
        ],
        atRisk: [],
      });

      const { container } = render(<StatsPage />);

      // Hardest cards section — real prompts render, and DifficultyBar receives the
      // real difficulty value for each card (mocked to <span data-testid="difficulty">).
      screen.getByText("correre");
      screen.getByText("mangiare");
      expect(screen.queryByText("No data yet.")).toBeNull();

      // Weakest topics section — real tags, counts, and avg-difficulty values render.
      screen.getByText("verbs");
      screen.getByText("food");
      screen.getByText("5 cards");
      screen.getByText("3 cards");

      // DifficultyBar is called for both hardest cards (in order) and both weakest tags
      // (in order) — asserting all four values in one place proves neither block is
      // silently skipped and both pass the correct value through.
      const difficultyBars = screen.getAllByTestId("difficulty");
      expect(difficultyBars.map((el) => el.textContent)).toEqual(["8.4", "3.1", "7.2", "4.5"]);

      // Retention-bars section — median/count text for three levels, and the special
      // "No mastered cards" text for the zero-count level.
      screen.getByText("90d median · 12 cards");
      screen.getByText("12d median · 4 cards");
      screen.getByText("3d median · 2 cards");
      screen.getByText("No mastered cards");

      // The actual rendered bar elements, in level order (A1, A2, B1, B2) — exercises
      // both the real stabilityColorClass thresholds and the width-percentage calculation
      // (Math.min(100, (median / 60) * 100)) together, as the page actually computes them.
      const bars = container.querySelectorAll(".h-full.rounded-full.transition-all");
      expect(bars).toHaveLength(4);
      expect(bars[0]!.className).toContain("bg-green-500");
      expect((bars[0] as HTMLElement).style.width).toBe("100%"); // clamped from 150%
      expect(bars[1]!.className).toContain("bg-yellow-500");
      expect((bars[1] as HTMLElement).style.width).toBe("20%");
      expect(bars[2]!.className).toContain("bg-red-500");
      expect((bars[2] as HTMLElement).style.width).toBe("5%");
      expect(bars[3]!.className).toContain("bg-red-500");
      expect((bars[3] as HTMLElement).style.width).toBe("0%");
    } finally {
      // Restore the hardcoded mock so later test runs in this file (if reordered) aren't
      // affected by this test's real-implementation override.
      vi.mocked(stabilityColorClass).mockReturnValue("text-green-400");
    }
  });
});
