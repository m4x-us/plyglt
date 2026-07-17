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

// Task #340: This module is the SOLE AUTHORIZED CALLER of window.localStorage for
// LANG_PAIR_KEY. CLAUDE.md §3 requires all localStorage access to route through
// lib/storage.ts, but createPlatformStorage() is async and cannot replace these
// synchronous render-body callers. Consolidating here (rather than calling
// window.localStorage directly at each use site) is the pragmatic middle ground: one
// place to audit, one place to change if the storage layer later grows a synchronous
// accessor. All callers outside this file must use the exported functions below —
// never window.localStorage.getItem/setItem(LANG_PAIR_KEY) directly.

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

/** Returns the full active language pair string (e.g. "en-it"). */
export function getLangPair(): string {
  if (typeof window === "undefined") return "en-it";
  return window.localStorage.getItem(LANG_PAIR_KEY) ?? "en-it";
}

/** Returns true iff a language pair has been explicitly stored. The getters above
 * synthesize defaults ("it" / "en-it") when nothing is stored, so they cannot answer
 * "has the user picked a language yet?" — first-run detection needs raw presence.
 * Added for app/page.tsx's returning-user redirect (Task #389), which previously read
 * window.localStorage directly in violation of this module's sole-authorized-caller rule.
 * Edge note: "stored" means key presence — a tampered value (even "") counts as stored;
 * downstream getters repair malformed values with a logged fallback. */
export function hasStoredLangPair(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(LANG_PAIR_KEY) !== null;
}
