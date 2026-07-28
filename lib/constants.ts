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

// Task #445 → #465: single source of truth for the pack-loading subsystem's fetch
// timeout. Previously declared independently in lib/basePackLoader.ts,
// lib/specialtyPackLoader.ts, and lib/packLoader.ts (now lib/packManifest.ts after
// Task #463's extraction) — three copies of the same tuning value with no mechanism
// forcing them to agree. Used by lib/fetchWithTimeout.ts's fetchWithTimeout(), the
// single shared implementation all 3 call sites now import (Task #464/#465).
export const FETCH_TIMEOUT_MS = 20_000;

// Task #340: This module is the SOLE AUTHORIZED CALLER of window.localStorage for
// LANG_PAIR_KEY. CLAUDE.md §3 requires all localStorage access to route through
// lib/storage.ts, but createPlatformStorage() is async and cannot replace these
// synchronous render-body callers. Consolidating here (rather than calling
// window.localStorage directly at each use site) is the pragmatic middle ground: one
// place to audit, one place to change if the storage layer later grows a synchronous
// accessor. All callers outside this file must use the exported functions below —
// never window.localStorage.getItem/setItem(LANG_PAIR_KEY) directly.

// Task #457: single source of truth for deriving the target-lang tail from a stored
// "en-{lang}" pair string. Task #446 made getTargetLangCode's and getLangPair's inline
// malformed-value checks byte-identical by copy-paste — that fixed the immediate bug but
// left two independent copies that could silently drift apart again on a future edit to
// just one of them. Sharing this function is the actual structural fix. Returns "" when
// the value is malformed (no hyphen, or nothing after it — e.g. "en-") — both callers
// below treat an empty result as "needs repair".
function deriveLangTail(pair: string): string {
  // slice from after the first hyphen — .split('-')[1] would truncate hyphenated codes
  // like "it-medical" to "it".
  const sepIdx = pair.indexOf("-");
  return sepIdx === -1 ? "" : pair.slice(sepIdx + 1);
}

/** Returns the stored target language code, defaulting to "it". */
export function getTargetLangCode(): string {
  if (typeof window === "undefined") return "it";
  let pair: string;
  try {
    pair = window.localStorage.getItem(LANG_PAIR_KEY) ?? "en-it";
  } catch (e) {
    // Task #434: localStorage can throw (private-browsing quota errors, disabled storage
    // in a locked-down webview). No ErrorBoundary exists anywhere in this app, so an
    // uncaught throw here would crash the page instead of degrading like lib/storage.ts's
    // createPlatformStorage does for the Zustand stores.
    console.error(`[ERR-CONST-GET-TARGET-LANG-${Date.now()}] localStorage.getItem threw for "${LANG_PAIR_KEY}": ${String(e)}. Falling back to "it".`);
    return "it";
  }
  const target = deriveLangTail(pair);
  if (!target) {
    console.error(`[ERR-LANG-PAIR-MALFORMED-${Date.now()}] Stored "${LANG_PAIR_KEY}" value "${pair}" is malformed — expected "en-{lang}" format. Falling back to "it".`);
    // Task #408: persist the repair. A read-time-only fallback silently re-derives (and
    // re-logs) "it" on every single call to this function AND to getLangPair (same key)
    // forever — the corrupt value never actually gets fixed. setTargetLangCode writes the
    // canonical "en-it" form so the next read (by either getter) sees a repaired value.
    setTargetLangCode("it");
    return "it";
  }
  return target;
}

/** Writes the active language pair to localStorage. Source language is always "en". */
export function setTargetLangCode(targetLang: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LANG_PAIR_KEY, `en-${targetLang}`);
  } catch (e) {
    // Task #434: see getTargetLangCode above — a quota/disabled-storage throw here must
    // degrade (language selection just won't persist this session) rather than crash.
    console.error(`[ERR-CONST-SET-TARGET-LANG-${Date.now()}] localStorage.setItem threw for "${LANG_PAIR_KEY}": ${String(e)}. Language selection will not persist this session.`);
  }
}

/** Returns the full active language pair string (e.g. "en-it"). */
export function getLangPair(): string {
  if (typeof window === "undefined") return "en-it";
  let pair: string;
  try {
    pair = window.localStorage.getItem(LANG_PAIR_KEY) ?? "en-it";
  } catch (e) {
    console.error(`[ERR-CONST-GET-LANG-PAIR-${Date.now()}] localStorage.getItem threw for "${LANG_PAIR_KEY}": ${String(e)}. Falling back to "en-it".`);
    return "en-it";
  }
  // Task #408: getTargetLangCode already repairs a malformed value with a logged fallback
  // (hasStoredLangPair's doc comment above promises this for "downstream getters"
  // generically) — this getter used `?? "en-it"` alone, which only substitutes on
  // null/undefined, so a stored "" or hyphen-less garbage value passed through here
  // unrepaired and unlogged. Same malformed check, same persisted repair.
  // Task #446 → #457: the check must be IDENTICAL to getTargetLangCode's, not just "has
  // a hyphen" (`pair.indexOf("-") === -1` alone missed the empty-tail case, "en-" HAS a
  // hyphen — this fed store/srsStore.ts's persisted storage key `srs-${_activeLangPair}`
  // the malformed "srs-en-"). #446 fixed this by copy-pasting getTargetLangCode's inline
  // logic; #457 replaced both copies with one shared deriveLangTail() call (above) — the
  // actual structural guarantee against the two checks drifting apart again.
  const target = deriveLangTail(pair);
  if (!target) {
    console.error(`[ERR-LANG-PAIR-MALFORMED-${Date.now()}] Stored "${LANG_PAIR_KEY}" value "${pair}" is malformed — expected "en-{lang}" format. Falling back to "en-it".`);
    setTargetLangCode("it");
    return "en-it";
  }
  return pair;
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
  try {
    return window.localStorage.getItem(LANG_PAIR_KEY) !== null;
  } catch (e) {
    // Task #434: a throwing localStorage can't answer "is it stored?" — false is the
    // safe default (re-triggers the first-run flow rather than assuming a pair exists).
    console.error(`[ERR-CONST-HAS-LANG-PAIR-${Date.now()}] localStorage.getItem threw for "${LANG_PAIR_KEY}": ${String(e)}. Treating as not-yet-stored.`);
    return false;
  }
}
