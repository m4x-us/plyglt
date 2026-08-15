// ============================================================
// srsStore.ts — Zustand store: FSRS card progress, session state, and scheduling
// ============================================================
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { type CardProgress, defaultProgress, scheduleCard, isDue, type Grade, prerequisitesMet } from "@/lib/srs";
import type { Card, IntroductionRecord, Unit } from "@/content/types";
import {
  getDayOfPhase,
  MAX_PHASE_DAY,
  recordResult,
  shouldAppearToday,
} from "@/lib/introduction";
import { createPlatformStorage } from "@/lib/storage";
import { SRS_VERSION, migrateSrsStore } from "@/store/migrations";
import { getLangPair } from "@/lib/constants";
import { localDateStr } from "@/lib/utils";

export { localDateStr };

// Read lang pair at module initialization so the store is scoped to the
// language pair the user selected. A full page reload is required when
// switching languages (see app/page.tsx handleSelect).
// Task #421: routed through lib/constants.ts's getLangPair() — the sole-authorized-caller
// rule for LANG_PAIR_KEY storage access (CLAUDE.md §3) had one missed sibling here (Tasks
// #340/#389 fixed app/page.tsx and hooks/useExportImport.ts for the identical violation;
// this call site reimplemented getLangPair()'s SSR guard + "en-it" fallback inline instead
// of calling it, so it never got getLangPair()'s try/catch error handling either).
const _activeLangPair: string = getLangPair();

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
  // between card rating and streak/session persistence. Returns the resulting
  // CardProgress (Task #169) so callers can build a sync ReviewEvent from it
  // without recomputing scheduleCard() a second time at the hook layer.
  commitSession: (cardId: string, grade: Grade, session: ActiveSession) => CardProgress;
  clearActiveSession: () => void;
  getResumableSession: () => ActiveSession | null;

  // Returns IDs of cards in the unit that are due for review
  getDueCards: (unitCards: Card[]) => string[];

  // Returns Card objects that are new and whose prerequisites are met (tier-ordered)
  getNewCards: (unitCards: Card[], limit?: number) => Card[];
  // Batch 23 — interrupt-session floor fill: already-studied cards NOT yet due,
  // ordered soonest-due first, for pulling slightly early when a session would
  // otherwise fall below lib/queue.ts's INTERRUPT_SESSION_FLOOR. FSRS tolerates
  // early review (the scheduler simply reschedules from the actual review time).
  getNearDueCards: (unitCards: Card[], limit: number) => Card[];

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
  // maxPerDay defaults to 1 (BRAND.md's normal daily cap). Callers pass a higher value to
  // flex past the cap when the day's normal content supply (FSRS due + introduction cadence
  // + one new card) would otherwise leave a proactive interrupt with nothing to show — BRAND.md
  // commits to 6-10 interrupts every day, never fewer, so "nothing due" must never mean "skip
  // the lesson." See hooks/useInterruptConfig.ts's computeDue and hooks/useStudySession.ts's
  // mount effect, which apply the identical flex condition (Task: interrupt content floor).
  canIntroduceNewCard: (today: string, maxPerDay?: number) => boolean;
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
        return next;
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
        const introMap = get().introductions;
        // Task #567: a card mid-intensive-phase (has an IntroductionRecord) but not yet
        // graduated to FSRS (no CardProgress entry) previously still qualified as "new"
        // here — unlike lib/srs.ts's selectQualifyingNewCard, the real session-open fill
        // logic actually uses, which explicitly excludes any card with an existing
        // introductions[card.id] record. That divergence let hooks/useInterruptConfig.ts's
        // computeDue (which calls this function directly) promise "new card" content for a
        // card the real fill would refuse to introduce a second time outside the intensive
        // cadence's own schedule.
        return unitCards
          .filter((card) => !progressMap[card.id])
          .filter((card) => !introMap[card.id])
          .filter((card) => prerequisitesMet(card, progressMap))
          .sort((a, b) => a.tier - b.tier)
          .slice(0, limit);
      },

      getNearDueCards: (unitCards, limit) => {
        const progressMap = get().cards;
        const now = Date.now();
        return unitCards
          .filter((card) => {
            const p = progressMap[card.id];
            return p && p.reps > 0 && !isDue(p, now);
          })
          .sort((a, b) => progressMap[a.id]!.dueDate - progressMap[b.id]!.dueDate)
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

      canIntroduceNewCard: (today, maxPerDay = 1) => {
        const { introductions } = get();
        const values = Object.values(introductions);
        // Block once maxPerDay cards have been introduced today. Default 1 preserves the
        // normal BRAND.md cap; callers flexing past it for the interrupt-floor fallback pass
        // a higher value explicitly (see the interface comment above).
        const introducedTodayCount = values.filter((r) => r.introducedDate === today).length;
        if (introducedTodayCount >= maxPerDay) return false;
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
