// ============================================================
// srsStore.ts — Zustand store: FSRS card progress, session state, and scheduling
// ============================================================
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { type CardProgress, defaultProgress, scheduleCard, isDue, type Grade } from "@/lib/srs";
import type { Card, IntroductionRecord, Unit } from "@/content/types";
import {
  getDayOfPhase,
  MAX_PHASE_DAY,
  recordResult,
  shouldAppearToday,
} from "@/lib/introduction";
import { createPlatformStorage } from "@/lib/storage";
import { SRS_VERSION, migrateSrsStore } from "@/store/migrations";
import { LANG_PAIR_KEY } from "@/lib/constants";
import { localDateStr } from "@/lib/utils";

export { localDateStr };

// Read lang pair at module initialization so the store is scoped to the
// language pair the user selected. A full page reload is required when
// switching languages (see app/page.tsx handleSelect).
const _activeLangPair: string =
  typeof window !== "undefined"
    ? (window.localStorage.getItem(LANG_PAIR_KEY) ?? "en-it")
    : "en-it";

// A card is mastered only when it has been reviewed across multiple sessions at meaningful distance.
// FSRS assigns ~1–4 days stability on first graduation — that is single-session learning, not retention.
// 7 days requires at least one successful review after initial graduation.
export const MASTERY_STABILITY_DAYS = 7;

export const MASTERY_GATE = 80; // % of cards that must be mastered to unlock the next unit/level

export function isMastered(progress: CardProgress | undefined): boolean {
  return (
    progress?.state === "review" &&
    (progress?.stability ?? 0) >= MASTERY_STABILITY_DAYS
  );
}

// Persisted snapshot of an in-progress study session.
// Written on every card advance so a crash or forced interruption never loses position.
export interface ActiveSession {
  unitId: string | "global";
  queueIds: string[];     // ordered card IDs for this session
  position: number;       // next card index (cards 0..position-1 are already rated)
  sessionCorrect: number;
  sessionTotal: number;
  startedAt: number;      // unix ms — sessions expire after 24 hours
}

const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

interface SRSState {
  cards: Record<string, CardProgress>; // cardId → progress
  streak: number;
  lastStudiedDate: string | null;
  activeSession: ActiveSession | null;
  introductions: Record<string, IntroductionRecord>;

  getProgress: (cardId: string) => CardProgress;
  rateCard: (cardId: string, grade: Grade) => void;
  saveActiveSession: (session: ActiveSession) => void;
  rateCardAndSaveSession: (cardId: string, grade: Grade, session: ActiveSession) => void;
  // Atomic alternative to touchStreak() + rateCardAndSaveSession(): all three
  // state mutations happen in a single set() call, eliminating the crash window
  // between card rating and streak/session persistence.
  commitSession: (cardId: string, grade: Grade, session: ActiveSession) => void;
  clearActiveSession: () => void;
  getResumableSession: () => ActiveSession | null;

  // Returns IDs of cards in the unit that are due for review
  getDueCards: (unitCards: Card[]) => string[];

  // Returns Card objects that are new and whose prerequisites are met (tier-ordered)
  getNewCards: (unitCards: Card[], limit?: number) => Card[];

  getStats: (unitCards: Card[]) => {
    due: number;
    learning: number;
    mastered: number;
    total: number;
    masteryPct: number; // 0–100, for unit unlock gates (≥ 80 unlocks next unit)
  };

  touchStreak: () => void;

  // Introduction engine — intensive repetition cadence before FSRS graduation
  introduceCard: (cardId: string, today: string) => void;
  recordIntroductionResult: (cardId: string, correct: boolean, today: string) => void;
  getIntroductionDueCardIds: (today: string) => string[];
  canIntroduceNewCard: (today: string) => boolean;
}

function prerequisitesMet(card: Card, progressMap: Record<string, CardProgress>): boolean {
  if (!card.prerequisites?.length) return true;
  return card.prerequisites.every((id) => progressMap[id]?.state === "review");
}

export const useSRSStore = create<SRSState>()(
  persist(
    (set, get) => ({
      cards: {},
      streak: 0,
      lastStudiedDate: null,
      activeSession: null,
      introductions: {},

      getProgress: (cardId) => get().cards[cardId] ?? defaultProgress(cardId),

      rateCard: (cardId, grade) => {
        const prev = get().getProgress(cardId);
        const next = scheduleCard(prev, grade);
        set((s) => ({ cards: { ...s.cards, [cardId]: next } }));
      },

      saveActiveSession: (session) => set({ activeSession: session }),

      rateCardAndSaveSession: (cardId, grade, session) => {
        const prev = get().getProgress(cardId);
        const next = scheduleCard(prev, grade);
        set((s) => ({ cards: { ...s.cards, [cardId]: next }, activeSession: session }));
      },

      commitSession: (cardId, grade, session) => {
        const prev = get().getProgress(cardId);
        const next = scheduleCard(prev, grade);
        const today = localDateStr();
        const { lastStudiedDate, streak } = get();
        const yd = new Date();
        yd.setDate(yd.getDate() - 1);
        const yesterday = localDateStr(yd);
        const streakPatch =
          lastStudiedDate === today
            ? undefined
            : { streak: lastStudiedDate === yesterday ? streak + 1 : 1, lastStudiedDate: today };
        set((s) => ({
          cards: { ...s.cards, [cardId]: next },
          activeSession: session,
          ...streakPatch,
        }));
      },

      clearActiveSession: () => set({ activeSession: null }),

      getResumableSession: () => {
        const session = get().activeSession;
        if (!session) return null;
        if (Date.now() - session.startedAt > SESSION_EXPIRY_MS) {
          set({ activeSession: null });
          return null;
        }
        return session;
      },

      getDueCards: (unitCards) => {
        const now = Date.now();
        const progressMap = get().cards;
        return unitCards
          .filter((card) => {
            const p = progressMap[card.id];
            return p && p.reps > 0 && isDue(p, now);
          })
          .map((c) => c.id);
      },

      getNewCards: (unitCards, limit = 20) => {
        const progressMap = get().cards;
        return unitCards
          .filter((card) => !progressMap[card.id])
          .filter((card) => prerequisitesMet(card, progressMap))
          .sort((a, b) => a.tier - b.tier)
          .slice(0, limit);
      },

      getStats: (unitCards) => {
        const progressMap = get().cards;
        const now = Date.now();
        const ids = unitCards.map((c) => c.id);

        const due = ids.filter((id) => {
          const p = progressMap[id];
          return p && p.reps > 0 && isDue(p, now);
        }).length;

        const learning = ids.filter((id) => {
          const p = progressMap[id];
          return p && (p.state === "learning" || p.state === "relearning");
        }).length;

        const mastered = ids.filter((id) => isMastered(progressMap[id])).length;

        return {
          due,
          learning,
          mastered,
          total: ids.length,
          masteryPct: ids.length === 0 ? 0 : Math.round((mastered / ids.length) * 100),
        };
      },

      touchStreak: () => {
        const today = localDateStr();
        const { lastStudiedDate, streak } = get();
        if (lastStudiedDate === today) return;
        const yd = new Date();
        yd.setDate(yd.getDate() - 1);
        const yesterday = localDateStr(yd);
        set({ streak: lastStudiedDate === yesterday ? streak + 1 : 1, lastStudiedDate: today });
      },

      introduceCard: (cardId, today) => {
        const existing = get().introductions[cardId];
        if (existing) return; // any existing record (including graduated) must not be overwritten
        const record: IntroductionRecord = {
          cardId,
          introducedDate: today,
          phaseStartDate: today,
          dayOfPhase: 1,
          consecutiveCorrect: 0,
          totalEncounters: 0,
          lastSeenDate: today,
          appearancesToday: 0,
          consecutiveWrongToday: 0,
          lastSeenType: null,
          graduated: false,
        };
        set((s) => ({ introductions: { ...s.introductions, [cardId]: record } }));
      },

      recordIntroductionResult: (cardId, correct, today) => {
        const record = get().introductions[cardId];
        if (!record) {
          console.error(`[plyglt] recordIntroductionResult: unknown cardId "${cardId}" — no introduction record found`);
          return;
        }
        let dayOfPhase: number;
        try {
          dayOfPhase = getDayOfPhase(record.phaseStartDate, today);
        } catch (err) {
          console.error(`[ERR-INTRO-RESULT-${cardId}] corrupt phaseStartDate "${record.phaseStartDate}" — skipping update`, err);
          // Task #254/#258: getDayOfPhase threw — full recordResult cannot run.
          // A correct answer fully repairs the record: phaseStartDate is reset to today
          // (Task #258 — so the card can rejoin getIntroductionDueCardIds at Day-1 intensity
          // rather than being permanently orphaned) AND strandedAcrossDays is cleared if set
          // (Task #254 — unblocking canIntroduceNewCard). A wrong answer does neither —
          // BRAND.md requires an actual correct retrieval for recovery.
          if (correct) {
            set((s) => {
              const prev = s.introductions[cardId];
              if (!prev) return s;
              const next = { ...prev, phaseStartDate: today };
              if (prev.strandedAcrossDays === true) {
                next.strandedAcrossDays = false;
              }
              return { introductions: { ...s.introductions, [cardId]: next } };
            });
          }
          return;
        }
        const updated = recordResult({ ...record, dayOfPhase }, correct, today);
        set((s) => ({ introductions: { ...s.introductions, [cardId]: updated } }));
      },

      getIntroductionDueCardIds: (today) => {
        const { introductions } = get();
        return Object.entries(introductions)
          .filter(([cardId, record]) => {
            let dayOfPhase: number;
            try {
              dayOfPhase = getDayOfPhase(record.phaseStartDate, today);
            } catch (err) {
              console.error(`[ERR-INTRO-DUE-${cardId}] corrupt phaseStartDate "${record.phaseStartDate}" — skipping from due set`, err);
              return false;
            }
            // Rescue path: day MAX_PHASE_DAY+ non-graduates would get maxAppearancesToday=0 and
            // disappear permanently from both queues. Show once per day until graduation.
            if (!record.graduated && dayOfPhase >= MAX_PHASE_DAY) {
              const appearances = record.lastSeenDate === today ? record.appearancesToday : 0;
              return appearances < 1;
            }
            return shouldAppearToday({ ...record, dayOfPhase }, today);
          })
          .map(([cardId]) => cardId);
      },

      canIntroduceNewCard: (today) => {
        const { introductions } = get();
        const values = Object.values(introductions);
        // One new card per day: block if any card was introduced today
        if (values.some((r) => r.introducedDate === today)) return false;
        // BRAND.md: pause introductions until the stranded card stabilizes (any correct answer).
        // strandedAcrossDays is the authoritative signal — set on triple-wrong, cleared only by
        // a correct answer. The prior guard also required lastSeenDate !== today, which caused
        // any same-day review (even wrong) to silently lift the pause (Task #246 fix).
        if (values.some((r) => r.strandedAcrossDays)) return false;
        return true;
      },
    }),
    {
      name: `srs-${_activeLangPair}`,
      version: SRS_VERSION,
      migrate: migrateSrsStore,
      storage: createJSONStorage(() => createPlatformStorage(`srs-${_activeLangPair}`)),
    }
  )
);

// Derive per-unit mastery for the unlock gate (≥ 80% → next unit unlocks)
export function unitMasteryPct(unit: Unit, progressMap: Record<string, CardProgress>): number {
  if (unit.cards.length === 0) return 0;
  const mastered = unit.cards.filter((c) => isMastered(progressMap[c.id])).length;
  return Math.round((mastered / unit.cards.length) * 100);
}

// Aggregate mastery across all units in a level (sum of all cards, not average of unit %s)
export function levelMasteryPct(units: Unit[], progressMap: Record<string, CardProgress>): number {
  if (units.length === 0) return 0;
  const total = units.reduce((s, u) => s + u.cards.length, 0);
  const mastered = units.reduce(
    (s, u) => s + u.cards.filter((c) => isMastered(progressMap[c.id])).length,
    0
  );
  return total === 0 ? 0 : Math.round((mastered / total) * 100);
}

// Returns the highest level string that has any mastery (masteryFn > 0), defaulting to levels[0].
export function currentStudyLevel(levels: readonly string[], masteryFn: (lvl: string) => number): string {
  for (let i = levels.length - 1; i >= 0; i--) {
    if (masteryFn(levels[i]!) > 0) return levels[i]!;
  }
  return levels[0] ?? "";
}
