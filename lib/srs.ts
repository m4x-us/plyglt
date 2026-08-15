// ============================================================
// srs.ts — FSRS v4 scheduler: memory model, card scheduling, and answer evaluation
// ============================================================
// FSRS v4 — Free Spaced Repetition Scheduler
// https://github.com/open-spaced-repetition/fsrs4anki
// Replaces SM-2. Models memory as Stability (S) × Difficulty (D).
// autoRate() maps observable performance signals to a Grade; FSRS does the scheduling.

import type { Card, IntroductionRecord } from "@/content/types";

// ── Types ────────────────────────────────────────────────────────────────────

export type Grade = "again" | "hard" | "good" | "easy";
export type CardState = "new" | "learning" | "review" | "relearning";

export interface CardProgress {
  cardId: string;
  state: CardState;
  stability: number;      // S — how many days before 90% forgetting
  difficulty: number;     // D — 1 (easy) to 10 (hard)
  retrievability: number; // R — current recall probability 0–1
  dueDate: number;        // unix ms
  lapses: number;         // times forgotten after graduating to "review"
  reps: number;           // total reviews
}

// ── FSRS v4 constants ────────────────────────────────────────────────────────

// Default weights trained on a large Anki review dataset.
// Typed as a tuple so indexed access is number (not number | undefined).
const W: [
  number, number, number, number,  // 0–3: initial S for Again/Hard/Good/Easy
  number, number,                  // 4–5: D0 base, D0 step per rating
  number, number,                  // 6–7: D mean-reversion factor, D per-grade adjustment
  number, number, number,          // 8–10: recall stability SRS params
  number, number, number,          // 11–13: lapse stability SFS params
  number, number,                  // 14–15: R effect on SFS, Hard penalty on SRS
  number,                          // 16: Easy bonus on SRS
] = [
  0.4072, 1.1829, 3.1262, 15.4722,
  7.2102, 0.5316,
  1.0651, 0.0589,
  1.5330, 0.1544, 1.0070,
  1.9395, 0.1100, 0.2900,
  2.2700, 0.2000,
  2.9898,
];

const DECAY = -0.5;
const FACTOR = 19 / 81; // chosen so that R(t=S, S) = 0.9 exactly
const TARGET_RETENTION = 0.9;

// ── Core FSRS formulas ───────────────────────────────────────────────────────

function retrievability(elapsedDays: number, stability: number): number {
  return Math.pow(1 + FACTOR * (elapsedDays / stability), DECAY);
}

function nextInterval(stability: number): number {
  // I = (S/FACTOR) * (r^(1/DECAY) - 1) — with TARGET_RETENTION this simplifies to ≈ S
  const interval = (stability / FACTOR) * (Math.pow(TARGET_RETENTION, 1 / DECAY) - 1);
  return Math.max(1, Math.min(36500, Math.round(interval)));
}

function gradeToInt(g: Grade): 1 | 2 | 3 | 4 {
  switch (g) {
    case "again": return 1;
    case "hard":  return 2;
    case "good":  return 3;
    case "easy":  return 4;
  }
}

function initialStability(grade: Grade): number {
  switch (grade) {
    case "again": return W[0];
    case "hard":  return W[1];
    case "good":  return W[2];
    case "easy":  return W[3];
  }
}

function initialDifficulty(grade: Grade): number {
  const g = gradeToInt(grade);
  return clampD(W[4] - (g - 3) * W[5]);
}

// Stability after Recall (successful review)
function stabilityAfterRecall(D: number, S: number, R: number, grade: Grade): number {
  const g = gradeToInt(grade);
  const hardPenalty = g === 2 ? W[15] : 1.0;
  const easyBonus = g === 4 ? W[16] : 1.0;
  return S * (
    Math.exp(W[8]) * (11 - D) * Math.pow(S, -W[9]) *
    (Math.exp(W[10] * (1 - R)) - 1) *
    hardPenalty * easyBonus + 1
  );
}

// Stability after Forgetting (lapse — grade "again" while in review state)
function stabilityAfterForgetting(D: number, S: number, R: number): number {
  return W[11] * Math.pow(D, -W[12]) * (Math.pow(S + 1, W[13]) - 1) * Math.exp(W[14] * (1 - R));
}

// Difficulty update after a review
function updateDifficulty(D: number, grade: Grade): number {
  const g = gradeToInt(grade);
  const d0easy = W[4] - 1 * W[5]; // D0 for Easy (grade 4)
  return clampD(W[6] * d0easy + (1 - W[6]) * (D - W[7] * (g - 3)));
}

function clampD(d: number): number {
  return Math.max(1, Math.min(10, d));
}

// ── Public API ───────────────────────────────────────────────────────────────

export function defaultProgress(cardId: string): CardProgress {
  return {
    cardId,
    state: "new",
    stability: 0,
    difficulty: W[4], // neutral starting difficulty
    retrievability: 1,
    dueDate: Date.now(),
    lapses: 0,
    reps: 0,
  };
}

export function scheduleCard(
  prev: CardProgress,
  grade: Grade,
  now = Date.now()
): CardProgress {
  const elapsedDays = prev.state === "new" ? 0
    : Math.max(0, (now - (prev.dueDate - prev.stability * 86400000)) / 86400000);

  const R = prev.state === "new" ? 1 : retrievability(elapsedDays, prev.stability);
  let { stability: S, difficulty: D, lapses, reps } = prev;
  reps += 1;

  let state: CardState;
  let interval: number;

  if (prev.state === "new" || prev.state === "learning") {
    if (grade === "again") {
      // Stay in learning, review again immediately in this session
      S = initialStability("again");
      D = initialDifficulty("again");
      state = "learning";
      interval = 0;
    } else {
      // Graduate to review
      S = initialStability(grade);
      D = initialDifficulty(grade);
      state = "review";
      interval = nextInterval(S);
    }
  } else if (prev.state === "review" || prev.state === "relearning") {
    D = updateDifficulty(D, grade);
    if (grade === "again") {
      lapses += 1;
      S = stabilityAfterForgetting(D, S, R);
      state = "relearning";
      interval = 0; // back in session
    } else {
      S = stabilityAfterRecall(D, S, R, grade);
      state = "review";
      interval = nextInterval(S);
    }
  } else {
    state = "review";
    interval = 1;
  }

  const dueDate = interval === 0 ? now : now + interval * 86400000;

  return {
    cardId: prev.cardId,
    state,
    stability: Math.max(0.001, Math.min(36500, S)),
    difficulty: D,
    retrievability: R,
    dueDate,
    lapses,
    reps,
  };
}

export function isDue(card: CardProgress, now = Date.now()): boolean {
  return card.dueDate <= now;
}

// ── Prerequisite gating — single source of truth ─────────────────────────────
// Relocated from store/srsStore.ts (Batch 18) — pure function over Card/CardProgress belongs
// in lib/, not as a private helper duplicated across every consumer that needs the same
// content/types.ts Card.prerequisites contract enforced.

// Returns true if all of `card`'s prerequisite cards have reached "review" state in
// progressMap (or the card has no prerequisites). Single source of truth for prerequisite
// gating — reused by srsStore.getNewCards (FSRS new-card queue) and selectQualifyingNewCard
// (introduction-engine new-card gating), so the two subsystems can never diverge on how
// content/types.ts's Card.prerequisites contract is enforced.
export function prerequisitesMet(card: Card, progressMap: Record<string, CardProgress>): boolean {
  if (!card.prerequisites?.length) return true;
  return card.prerequisites.every((id) => progressMap[id]?.state === "review");
}

// Returns the first tier-ascending card eligible for introduction (untouched by FSRS, not
// already introduced, prerequisites satisfied), or null if none qualify. Single source of
// truth — used by both hooks/useStudySession.ts's mount effect and
// tests/seam_studyLoop.test.ts, so the seam test exercises the exact same selection logic
// production runs rather than a hand-duplicated copy that can silently drift.
export function selectQualifyingNewCard(
  allCardMap: Record<string, Card>,
  cards: Record<string, CardProgress>,
  introductions: Record<string, IntroductionRecord>,
  // Batch 23: the interrupt-session floor picks SEVERAL new cards in one mount
  // effect, but `introductions` is a snapshot from before the effect ran — the
  // caller passes the ids it has already introduced this pass so the same card
  // is never selected twice within one fill loop.
  excludeIds?: ReadonlySet<string>
): Card | null {
  const qualifying = Object.values(allCardMap)
    .filter((c) => !cards[c.id] && !introductions[c.id] && !excludeIds?.has(c.id) && prerequisitesMet(c, cards))
    .sort((a, b) => a.tier - b.tier);
  return qualifying[0] ?? null;
}

// ── autoRate: performance signals → Grade ────────────────────────────────────

// Derives a Grade from observable signals — the user never rates manually.
// attempts: number of submissions before the correct answer (or ≥ 3 = give up)
// elapsedMs: milliseconds from card load to correct submission
// wasClose: true if the match was fuzzy (typo / missing accent)
export function autoRate(attempts: number, elapsedMs: number, wasClose: boolean): Grade {
  if (attempts >= 3) return "again";
  if (attempts === 2) return "hard";
  if (wasClose) return "good"; // fuzzy match caps at good regardless of speed
  if (elapsedMs < 10_000) return "easy";
  if (elapsedMs < 25_000) return "good";
  return "hard";
}

// Re-exports for backwards compatibility — prefer importing from lib/answerCheck directly
export { checkAnswer, levenshtein, stripArticle, ITALIAN_ARTICLES, SPANISH_ARTICLES } from "@/lib/answerCheck";
