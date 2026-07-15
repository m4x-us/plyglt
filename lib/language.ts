// ============================================================
// language.ts — Language configurations and UI strings for all supported languages
// ============================================================
import type { Card } from "@/content/types";
import { ITALIAN_ARTICLES, SPANISH_ARTICLES } from "@/lib/answerCheck";

export interface LanguageConfig {
  code: string;       // ISO 639-1: "it", "de", "es"
  name: string;       // In English: "Italian"
  nativeName: string; // In the language itself: "Italiano"
  flag: string;       // "🇮🇹"
  // RegExp to strip definite/indefinite articles before fuzzy matching.
  // null = skip (e.g. Polish, Greek — no articles in those languages).
  articles: RegExp | null;
  // When true, a typed answer missing diacritics (e.g. "caffe" for "caffè") scores
  // "close" rather than "wrong". When false, exact NFC match is required for "correct".
  diacriticTolerant: boolean;
  uiStrings: {
    appTitle: string;
    appSubtitle: string;
    correctFeedback: string; // shown on correct answer flash
    closeFeedback: string;   // shown when answer is close but not exact
    cardLabels: Record<Card["type"], string>;
    curriculumCredit: string;
  };
}

// Returns the prompt text for a card in the learner's source language.
// For most card types the prompt is always in the target language — only
// "produce" cards vary by source language.
export function getPrompt(card: Card, sourceLangCode: string): string {
  if (card.type === "produce") {
    return card.prompts?.[sourceLangCode] ?? card.prompt; // fallback to canonical (English)
  }
  return card.prompt;
}

// Returns the accepted answers for a card in the learner's source language.
// For "recognize" cards the user must type in their own language — all other
// card types always accept target-language answers regardless of source.
export function getAccepted(card: Card, sourceLangCode: string): string[] {
  if (card.type === "recognize") {
    return card.translations?.[sourceLangCode] ?? card.accepted; // fallback to canonical (English)
  }
  return card.accepted;
}

// ── App-level brand strings (single place to change) ─────────────────────────

export const APP_NAME = "plyglt";
export const APP_SUBTITLE = "Vocabulary to fluency, paced to how your memory actually works.";

// ── Language definitions ──────────────────────────────────────────────────────

export const ITALIAN: LanguageConfig = {
  code: "it",
  name: "Italian",
  nativeName: "Italiano",
  flag: "🇮🇹",
  articles: ITALIAN_ARTICLES,
  diacriticTolerant: true,
  uiStrings: {
    appTitle: APP_NAME,
    appSubtitle: APP_SUBTITLE,
    correctFeedback: "Corretto.",
    closeFeedback: "Quasi! Close enough.",
    cardLabels: {
      produce: "Type in Italian",
      recognize: "Translate to English",
      conjugate: "Conjugate the verb",
      fill_blank: "Fill in the blank",
      passage_cloze: "Read and fill the blank",
    },
    curriculumCredit: "Curriculum: imparitaliano.com · CEFR A1–B2",
  },
};

export const SPANISH: LanguageConfig = {
  code: "es",
  name: "Spanish",
  nativeName: "Español",
  flag: "🇪🇸",
  articles: SPANISH_ARTICLES,
  diacriticTolerant: true,
  uiStrings: {
    appTitle: APP_NAME,
    appSubtitle: APP_SUBTITLE,
    correctFeedback: "Correcto.",
    closeFeedback: "¡Casi! Close enough.",
    cardLabels: {
      produce:       "Type in Spanish",
      recognize:     "Translate to English",
      conjugate:     "Conjugate the verb",
      fill_blank:    "Fill in the blank",
      passage_cloze: "Read and fill the blank",
    },
    curriculumCredit: "Español A1 · Beta 0.9",
  },
};

// Keep this map in sync with LANGUAGE_REGISTRY in lib/langRegistry.ts.
// When adding a new language: add the real LanguageConfig above, then add it here.
// The poka-yoke test in tests/language.test.ts guards against drift.
const LANGUAGE_MAP: Record<string, LanguageConfig> = {
  it: ITALIAN,
  es: SPANISH,
};

/**
 * Returns the LanguageConfig for a target language code.
 *
 * Specialty pack codes (e.g. "it-medical") are not in LANGUAGE_MAP — they share their
 * base language's config. The base code is extracted by splitting on the first hyphen.
 * Importing lib/langRegistry.ts to check SPECIALTY_PACKS directly is not possible here
 * because langRegistry.ts already imports ITALIAN/SPANISH from this file.
 *
 * Falls back to ITALIAN with an error log for genuinely unrecognised codes — the fallback
 * is intentional for graceful degradation, but the error signal prevents silent masking
 * of misconfigured callers. Add new languages to LANGUAGE_MAP above; the poka-yoke test
 * in tests/language.test.ts will catch LANGUAGE_MAP / LANGUAGE_REGISTRY drift.
 */
export function getLanguageConfig(code: string): LanguageConfig {
  const config = LANGUAGE_MAP[code];
  if (!config) {
    // Specialty pack codes (e.g. "it-medical") share their base language's config.
    // Log on this path so misconfigured callers don't pass silently — the comment
    // about "preventing silent masking" must be backed by an actual log statement.
    const hyphen = code.indexOf("-");
    if (hyphen !== -1) {
      const baseConfig = LANGUAGE_MAP[code.slice(0, hyphen)];
      if (baseConfig) {
        console.warn(`[WARN-LANG-CONFIG-SPECIALTY-${Date.now()}] "${code}" is not in LANGUAGE_MAP — using base-language config "${code.slice(0, hyphen)}". If this is not a registered specialty pack code, update LANGUAGE_MAP.`);
        return baseConfig;
      }
    }
    console.error(`[ERR-LANG-CONFIG-UNKNOWN-${Date.now()}] No LanguageConfig for "${code}" — update LANGUAGE_MAP in lib/language.ts`);
    return ITALIAN;
  }
  return config;
}

// ── Active language (static export — used for metadata only) ──────────────────
// Components should call getLanguageConfig(targetLang) at runtime instead.
export const ACTIVE_LANGUAGE: LanguageConfig = ITALIAN;
export const SOURCE_LANG_CODE = "en";
