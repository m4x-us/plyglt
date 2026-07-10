// ============================================================
// CONSTANTS — Application-level shared constants
// ============================================================
// Constants and localStorage helpers shared across layers that
// cannot live in a hook or store without creating upward import
// violations (Rule 3: layers flow down only).
// ============================================================
// DEPENDS ON: nothing (intentionally dependency-free)
// USED BY: grep -r "from \"@/lib/constants\"" --include="*.ts" --include="*.tsx" .
// ============================================================

/** Single source of truth for the localStorage key that tracks the active language pair. */
export const LANG_PAIR_KEY = "srs-lang-pair";

/** Returns the stored target language code, defaulting to "it". */
export function getTargetLangCode(): string {
  if (typeof window === "undefined") return "it";
  const pair = window.localStorage.getItem(LANG_PAIR_KEY) ?? "en-it";
  // slice from after the first hyphen — .split('-')[1] would truncate hyphenated codes
  // like "it-medical" to "it". No-hyphen means the stored value is malformed.
  const sepIdx = pair.indexOf("-");
  if (sepIdx === -1) {
    console.error(`[ERR-LANG-PAIR-MALFORMED-${Date.now()}] Stored "${LANG_PAIR_KEY}" value "${pair}" has no hyphen — expected "en-{lang}" format. Falling back to "it".`);
    return "it";
  }
  return pair.slice(sepIdx + 1) || "it";
}

/** Writes the active language pair to localStorage. Source language is always "en". */
export function setTargetLangCode(targetLang: string): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANG_PAIR_KEY, `en-${targetLang}`);
  }
}
