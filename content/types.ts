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
