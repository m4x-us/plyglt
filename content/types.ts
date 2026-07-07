// ============================================================
// content/types.ts — type definitions for language pack content
// ============================================================

// "recognize": show target-language word, user types translation in their own language
// "produce":   show word in user's language, user types the target-language word
// "conjugate" / "fill_blank" / "passage_cloze": target language only — no source language involved
export type CardType = "recognize" | "produce" | "conjugate" | "fill_blank" | "passage_cloze";
export type Level = "A1" | "A2" | "B1" | "B2";
export type Tier = 1 | 2 | 3 | 4;

export interface Card {
  id: string;
  type: CardType;
  // recognize/conjugate/fill_blank/passage_cloze: always target language
  // produce: canonical source language (English as authored)
  prompt: string;
  // recognize: canonical source-language translation (English as authored)
  // produce/conjugate/fill_blank/passage_cloze: target-language accepted forms
  accepted: string[];
  // recognize only: accepted translations for non-English source languages
  // e.g. { "es": ["rojo"], "fr": ["rouge"], "de": ["rot"] }
  translations?: Record<string, string[]>;
  // produce only: prompt text in non-English source languages
  // e.g. { "es": "rojo", "fr": "rouge", "de": "rot" }
  prompts?: Record<string, string>;
  hint?: string;
  tags: string[];
  tier: Tier;
  // Card IDs that must have state === "review" before this card is offered
  prerequisites?: string[];
  deprecated?: boolean;
}

export interface Unit {
  id: string;
  name: string;
  level: Level;
  theme: string;     // e.g. "Food & the Bar", shown in UI
  emoji: string;
  // Unit IDs that must reach ≥ 80% mastery before this unit unlocks
  prerequisiteUnits: string[];
  cards: Card[];
}

// Tracks a single card's state during the intensive introduction phase (BRAND.md cadence table).
// The introduction engine uses this before handing off to FSRS at graduation.
export interface IntroductionRecord {
  cardId: string;
  introducedDate: string;          // ISO date YYYY-MM-DD of first exposure (calendar metadata only)
  phaseStartDate: string;          // ISO date YYYY-MM-DD used to compute dayOfPhase; advances on triple-wrong reset to restart Day 1 intensity
  dayOfPhase: number;              // calendar days since phaseStartDate + 1; max 22 (recomputed by callers — not persisted authoritatively)
  consecutiveCorrect: number;      // resets to 0 on any wrong answer
  totalEncounters: number;         // total times shown across all sessions
  lastSeenDate: string;            // ISO date YYYY-MM-DD of most recent session
  appearancesToday: number;        // appearances so far today (resets each calendar day)
  consecutiveWrongToday: number;   // wrong streak today; triggers Day 1 reset at 3
  lastSeenType: CardType | null;   // card type shown in the most recent encounter (variety rule)
  graduated: boolean;              // true once handed off to FSRS (15 consecutive correct)
}
