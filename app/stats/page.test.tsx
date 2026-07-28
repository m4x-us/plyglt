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
  stabilityColorClass: () => "text-green-400",
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
import StatsPage from "./page";

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
});
