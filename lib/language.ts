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
 * Two distinct fallback signals, of DIFFERENT strength (Task #425 — do not conflate them):
 * - No hyphen, or a hyphen whose prefix isn't in LANGUAGE_MAP either: genuinely
 *   unrecognised. Logs console.ERROR and returns ITALIAN — this is the strong signal that
 *   actually "prevents silent masking of misconfigured callers".
 * - A hyphen whose prefix IS in LANGUAGE_MAP: logs only console.WARN and silently returns
 *   the base config. Because this function cannot check SPECIALTY_PACKS membership (the
 *   circular-import constraint above), a garbage suffix on a valid prefix (e.g. "it-typo")
 *   takes the exact same silent-success path as a genuinely registered specialty code
 *   (e.g. "it-medical") — this is a WEAK signal by construction, not the same guarantee as
 *   the no-hyphen branch above. Callers that need to distinguish a real specialty code from
 *   a typo must check lib/langRegistry.ts's isSpecialtyPackCode()/isRegisteredSpecialtyCode()
 *   themselves; this function alone cannot tell them apart.
 *
 * Add new languages to LANGUAGE_MAP above; the poka-yoke test in tests/language.test.ts
 * will catch LANGUAGE_MAP / LANGUAGE_REGISTRY drift.
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

// ── Source languages (the learner's own interface/native language) ────────────
// A DIFFERENT axis from target-language selection above: this is which language a
// "produce"/"recognize" card's prompt/accepted text is shown in via getPrompt/getAccepted's
// card.prompts/card.translations lookup (content/types.ts), not which language is being
// learned. Deliberately NOT part of lib/constants.ts's LANG_PAIR_KEY ("en-{target}") or its
// derived storage keys (store/srsStore.ts partitions SRS data by TARGET language only) —
// conflating the two would mean a user switching their interface language mid-course
// appears to lose all SRS progress for the language they're actively learning, since it
// would compute a different storage key. Persisted independently in settingsStore
// (SETTINGS_VERSION 3, store/migrations.ts) as a pure UI preference.
//
// Every entry here must have real content behind it — content/cards/*.ts's `prompts`/
// `translations` maps are keyed by these same codes (e.g. "es", from Batch 11's Spanish
// source-language translation work). Adding a code here with no real translated content
// is not harmful (getPrompt/getAccepted fall back to the canonical English text per-card),
// but defeats the point of listing it as a selectable option.
export const SOURCE_LANGUAGES: readonly { code: string; name: string; flag: string }[] = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "es", name: "Español", flag: "🇪🇸" },
];

export const DEFAULT_SOURCE_LANG_CODE = "en";

export function isKnownSourceLangCode(code: string): boolean {
  return SOURCE_LANGUAGES.some((s) => s.code === code);
}

// ── Article-stripping regex per SOURCE language (Task: audit fix, multi-language prep) ────
// "recognize" cards are graded against text in the learner's SOURCE language (see getAccepted
// above), not the target language — but checkAnswer was being called with the TARGET
// language's `articles` regex for every card type, including recognize. This meant a Spanish
// source-language learner typing "libro" for the accepted answer "el libro" was graded
// against ITALIAN_ARTICLES (which doesn't recognize "el"), producing "wrong" for what should
// be "correct" — the identical article-omission leniency Italian/Spanish target learners
// already get was silently denied to the recognize-card half of source-language selection.
// null = no stripping (English has no equivalent elision pattern this app models yet).
const SOURCE_LANG_ARTICLES: Record<string, RegExp | null> = {
  en: null,
  es: SPANISH_ARTICLES,
};

export function getSourceLanguageArticles(sourceLangCode: string): RegExp | null {
  return SOURCE_LANG_ARTICLES[sourceLangCode] ?? null;
}

// "Translate to {sourceLanguage}" is the correct instruction for a recognize card regardless
// of target language — unlike the other three card labels (produce/conjugate/fill_blank),
// which are properties of the TARGET language, this one depends on sourceLang and cannot live
// in a static per-target LanguageConfig.uiStrings.cardLabels entry the way it did when English
// was the only possible source. Falls back to "English" for an unrecognized code, matching
// DEFAULT_SOURCE_LANG_CODE.
export function getRecognizeLabel(sourceLangCode: string): string {
  const name = SOURCE_LANGUAGES.find((s) => s.code === sourceLangCode)?.name ?? "English";
  return `Translate to ${name}`;
}
