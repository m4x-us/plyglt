// ============================================================
// cardLabels.ts — Human-readable tier labels and card type display names
// ============================================================
export const TIER_LABELS: Record<number, string> = {
  1: "Vocabulary",
  2: "Grammar",
  3: "Phrases",
  4: "Sentences",
};

export function tierLabel(tier: number): string {
  return TIER_LABELS[tier] ?? "";
}
