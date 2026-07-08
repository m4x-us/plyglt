// ============================================================
// lib/introduction.ts — pure functions and constants for the intensive introduction engine
// DEPENDS ON: @/content/types (CardType, IntroductionRecord), @/lib/utils (DATE_RE, isCalendarValidDate)
// USED BY: store/srsStore.ts (introduceCard, recordIntroductionResult, getIntroductionDueCardIds,
//          canIntroduceNewCard), hooks/useStudySession.ts (session-start introduction logic)
// ============================================================
import type { CardType, IntroductionRecord } from "@/content/types";
import { isCalendarValidDate } from "@/lib/utils";

// Consecutive-correct threshold before a card graduates to the FSRS scheduler (BRAND.md).
export const GRADUATION_THRESHOLD = 15;

// Three consecutive wrong answers in a single calendar day resets the card to Day 1 intensity.
export const CONSECUTIVE_WRONG_RESET = 3;

// Maximum calendar-day phase index (inclusive). Phase days [1..MAX_PHASE_DAY-1] are active
// introduction; MAX_PHASE_DAY signals the FSRS hand-off point in the appearance table.
export const MAX_PHASE_DAY = 22;

// Maximum appearances per calendar day for each phase day (1-indexed).
// Day MAX_PHASE_DAY signals graduation — shouldAppearToday always returns false at or beyond this point.
// Values: Infinity = no daily cap; 0.5 = every other day (odd dayOfPhase only); 0 = graduated.
export const MAX_APPEARANCES_BY_PHASE_DAY: Readonly<Record<number, number>> = Object.freeze({
  1: Infinity, // every interrupt — 6–10× per day
  2: 5,        // every other interrupt — ~3–5× per day
  3: 2,
  4: 2,
  5: 2,
  6: 1,
  7: 1,
  8: 1,
  9: 1,
  10: 1,
  11: 0.5,
  12: 0.5,
  13: 0.5,
  14: 0.5,
  15: 0.5,
  16: 0.5,
  17: 0.5,
  18: 0.5,
  19: 0.5,
  20: 0.5,
  21: 0.5,
  [MAX_PHASE_DAY]: 0, // graduated to FSRS
});

// Returns the 1-based phase day for a card: calendar days since phaseStartDate + 1,
// clamped to [1, MAX_PHASE_DAY]. Both arguments are ISO date strings (YYYY-MM-DD).
// Parsed as UTC midnight so the diff is exact regardless of the caller's local timezone.
// Pre-condition: today >= phaseStartDate. If today < phaseStartDate (clock skew, bad data),
// diffDays is negative — the Math.max(1, ...) guard clamps the result to day 1.
// Throws on malformed or calendar-invalid input (e.g. "2026-13-45", "2026-02-30") —
// NaN propagation would cause silent card disappearance.
export function getDayOfPhase(phaseStartDate: string, today: string): number {
  if (!isCalendarValidDate(phaseStartDate) || !isCalendarValidDate(today)) {
    throw new Error(
      `[ERR-INTRO-DATE] getDayOfPhase: invalid date — expected valid YYYY-MM-DD, got phaseStartDate="${phaseStartDate}" today="${today}"`,
    );
  }
  const MS_PER_DAY = 86_400_000;
  const diffDays = Math.floor(
    (new Date(today).getTime() - new Date(phaseStartDate).getTime()) / MS_PER_DAY,
  );
  return Math.max(1, Math.min(diffDays + 1, MAX_PHASE_DAY));
}

// Returns the appearance cap for a given phase day. Days beyond the table (> MAX_PHASE_DAY) return 0.
export function maxAppearancesToday(dayOfPhase: number): number {
  return MAX_APPEARANCES_BY_PHASE_DAY[dayOfPhase] ?? 0;
}

// Returns true if the card should appear in a session today.
// Uses `today` (ISO YYYY-MM-DD) to detect a new calendar day and treat appearancesToday as 0.
// CALLER CONTRACT: dayOfPhase is not persisted authoritatively. Callers must compute it fresh via
// getDayOfPhase(record.phaseStartDate, today) and patch it before passing the record here.
export function shouldAppearToday(record: IntroductionRecord, today: string): boolean {
  if (record.graduated) return false;
  const max = maxAppearancesToday(record.dayOfPhase);
  if (max === 0) return false;
  // days 11–21 have max=0.5 (every other day): odd dayOfPhase values are the "on" days,
  // capped at 1 appearance per on-day (day boundary resets the cap, same as other phases).
  if (max === 0.5) {
    if (record.dayOfPhase % 2 !== 1) return false;
    const appearances = record.lastSeenDate === today ? record.appearancesToday : 0;
    return appearances < 1;
  }
  const appearances = record.lastSeenDate === today ? record.appearancesToday : 0;
  return appearances < max;
}

// Returns true when the card has met the graduation threshold of consecutive correct retrievals.
export function shouldGraduate(record: IntroductionRecord): boolean {
  return record.consecutiveCorrect >= GRADUATION_THRESHOLD;
}

// Records a review result and returns a new IntroductionRecord (immutable — original unchanged).
// `today` (ISO YYYY-MM-DD) is used to reset appearancesToday when the calendar date has changed.
export function recordResult(
  record: IntroductionRecord,
  correct: boolean,
  today: string,
): IntroductionRecord {
  const effectiveAppearancesToday =
    record.lastSeenDate === today ? record.appearancesToday : 0;

  const base: IntroductionRecord = {
    ...record,
    totalEncounters: record.totalEncounters + 1,
    appearancesToday: effectiveAppearancesToday + 1,
    lastSeenDate: today,
  };

  if (correct) {
    const consecutiveCorrect = record.consecutiveCorrect + 1;
    const result: IntroductionRecord = {
      ...base,
      consecutiveCorrect,
      consecutiveWrongToday: 0,
      graduated: shouldGraduate({ ...base, consecutiveCorrect }),
    };
    // Clear strandedAcrossDays on correct answer. Only set when currently true to avoid
    // adding strandedAcrossDays: false to records that never had it — this preserves the
    // shape of the return object for tests that use toEqual without the optional field.
    if (record.strandedAcrossDays === true) {
      result.strandedAcrossDays = false;
    }
    return result;
  }

  // Reset consecutiveWrongToday at day boundaries — wrongs from a prior day must not
  // carry over toward the triple-wrong Day 1 reset on a new calendar day.
  const consecutiveWrongToday = (record.lastSeenDate === today ? record.consecutiveWrongToday : 0) + 1;
  if (consecutiveWrongToday >= CONSECUTIVE_WRONG_RESET) {
    // BRAND.md: 3 consecutive wrong answers resets card to Day 1 intensity.
    // Advancing phaseStartDate to today means getDayOfPhase(record.phaseStartDate, today) → 1.
    // strandedAcrossDays: true blocks canIntroduceNewCard until a correct answer clears it.
    return { ...base, consecutiveCorrect: 0, consecutiveWrongToday: 0, phaseStartDate: today, strandedAcrossDays: true };
  }

  // BRAND.md: "Wrong once → card returns to Day 2 intensity" — interpreted as scheduling
  // frequency (5/day via MAX_APPEARANCES_BY_PHASE_DAY[2]), not as setting dayOfPhase=2.
  // dayOfPhase advances by calendar day; the frequency cap enforces intensity independently.
  return { ...base, consecutiveCorrect: 0, consecutiveWrongToday };
}

// Returns the next card type to show, avoiding the type most recently seen (variety rule).
// NOTE: The srsStore wiring (recordIntroductionResult updating lastSeenType) was removed as dead
// code in Task #229 — the content model has no sibling cards per word, so the selected type
// cannot influence what card is displayed. This function is kept exported for tests and future
// use when sibling-card support is added to the content model.
// If only one type is available, returns it regardless of lastSeenType.
export function getNextCardType(lastSeenType: CardType | null, available: CardType[]): CardType {
  const alternatives = lastSeenType !== null ? available.filter(t => t !== lastSeenType) : available;
  const pool = alternatives.length > 0 ? alternatives : available;
  const next = pool[0];
  if (next === undefined) throw new Error("[ERR-INTRO-EMPTY-POOL] getNextCardType: available must not be empty");
  return next;
}
