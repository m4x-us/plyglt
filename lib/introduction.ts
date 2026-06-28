// ============================================================
// lib/introduction.ts — pure functions and constants for the intensive introduction engine
// ============================================================
import type { CardType, IntroductionRecord } from "@/content/types";

// Maximum appearances per calendar day for each phase day (1-indexed).
// Day 22 signals graduation — shouldAppearToday always returns false at or beyond this point.
// Values: Infinity = no daily cap; 0.5 = every other day (odd dayOfPhase only); 0 = graduated.
export const MAX_APPEARANCES_BY_PHASE_DAY: Record<number, number> = {
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
  22: 0, // graduated to FSRS
};

// Returns the 1-based phase day for a card: calendar days since introduction + 1, clamped to [1, 22].
// Both arguments are ISO date strings (YYYY-MM-DD). Parsed as UTC midnight so the diff is
// exact regardless of the caller's local timezone.
// Pre-condition: today >= introducedDate. If today < introducedDate (clock skew, bad data),
// diffDays is negative — the Math.max(1, ...) guard clamps the result to day 1.
export function getDayOfPhase(introducedDate: string, today: string): number {
  const MS_PER_DAY = 86_400_000;
  const diffDays = Math.floor(
    (new Date(today).getTime() - new Date(introducedDate).getTime()) / MS_PER_DAY,
  );
  return Math.max(1, Math.min(diffDays + 1, 22));
}

// Returns the appearance cap for a given phase day. Days beyond the table (> 22) return 0.
export function maxAppearancesToday(dayOfPhase: number): number {
  return MAX_APPEARANCES_BY_PHASE_DAY[dayOfPhase] ?? 0;
}

// Returns true if the card should appear in a session today.
// Uses `today` (ISO YYYY-MM-DD) to detect a new calendar day and treat appearancesToday as 0.
export function shouldAppearToday(record: IntroductionRecord, today: string): boolean {
  if (record.graduated) return false;
  const max = maxAppearancesToday(record.dayOfPhase);
  if (max === 0) return false;
  // days 11–21 have max=0.5 (every other day); odd dayOfPhase values are the "on" days
  if (max === 0.5) return record.dayOfPhase % 2 === 1;
  const appearances = record.lastSeenDate === today ? record.appearancesToday : 0;
  return appearances < max;
}

// Returns true when the card has met the 15-consecutive-correct graduation threshold.
export function shouldGraduate(record: IntroductionRecord): boolean {
  return record.consecutiveCorrect >= 15;
}

// Records a review result and returns a new IntroductionRecord (immutable — original unchanged).
// `today` (ISO YYYY-MM-DD) is used to reset appearancesToday when the calendar date has changed.
// CALLER CONTRACT: dayOfPhase is not updated here. Callers must patch it via
// getDayOfPhase(record.introducedDate, today) before passing the record to shouldAppearToday.
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
    return {
      ...base,
      consecutiveCorrect,
      consecutiveWrongToday: 0,
      graduated: consecutiveCorrect >= 15,
    };
  }

  const consecutiveWrongToday = record.consecutiveWrongToday + 1;
  if (consecutiveWrongToday >= 3) {
    // BRAND.md: 3 consecutive wrong answers resets card to Day 1 intensity
    return { ...base, consecutiveCorrect: 0, consecutiveWrongToday: 0, dayOfPhase: 1 };
  }

  // BRAND.md: "Wrong once → card returns to Day 2 intensity" — interpreted as scheduling
  // frequency (5/day via MAX_APPEARANCES_BY_PHASE_DAY[2]), not as setting dayOfPhase=2.
  // dayOfPhase advances by calendar day; the frequency cap enforces intensity independently.
  // Re-evaluate this interpretation at store-wiring stage (#049).
  return { ...base, consecutiveCorrect: 0, consecutiveWrongToday };
}

// Returns the next card type to show, avoiding the type most recently seen (variety rule).
// BRAND.md: each encounter uses a different retrieval angle to produce durable memory.
// If only one type is available, returns it regardless of lastSeenType.
// CALLER CONTRACT: this function returns the type to show but does not update record.lastSeenType.
// Callers must write the returned CardType back to record.lastSeenType before the next call.
export function getNextCardType(lastSeenType: CardType | null, available: CardType[]): CardType {
  const alternatives = lastSeenType !== null ? available.filter(t => t !== lastSeenType) : available;
  const pool = alternatives.length > 0 ? alternatives : available;
  const next = pool[0];
  if (next === undefined) throw new Error("getNextCardType: available must not be empty");
  return next;
}
