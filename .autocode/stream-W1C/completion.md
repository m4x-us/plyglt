# Stream W1C — Wave 1 Completion (Task #033)
**Date:** 2026-06-27
**Agent:** Charles
**Status:** COMPLETE
**Verification gate at close:** tsc=PASS · 707/707 tests pass · lint=0 errors

## Tasks closed
- #033 — CONTRIBUTING_LANGUAGE.md: all 9 issues resolved

## What was done in #033

All 9 issues addressed in CONTRIBUTING_LANGUAGE.md:

1. **NFC normalization** — Added "Answer matching" preamble section: exportPack.ts NFC-normalizes on export; authors must not list both composed/decomposed forms.
2. **Diacritic tolerance** — Preamble: diacriticTolerant:true means accent-only diff = "close"; do not add duplicate accepted answers.
3. **"close" threshold** — Preamble: Levenshtein "close" only fires when accepted.length > 4 AND distance === 1; short words are strict.
4. **Card ID format** — Step 3: documents both formats — Italian (no lang prefix) and all other languages ({lang}- prefix required), with explanation.
5. **Step 2 TypeScript compile error** — Removed `pricing: { lifetime: "$9.99" }` from all LanguageEntry examples; added note that LanguageEntry has no pricing field.
6. **Step 5 french_lifetime** — Replaced with `{lang}_monthly` subscription key; added note that plyglt has no lifetime plans.
7. **French as worked example** — Replaced all fr/French references with generic {lang}/{LANG} placeholders (German used as concrete example to avoid confusion with removed fr).
8. **Step 1 wrong file** — `lib/srs.ts` → `lib/answerCheck.ts` for ITALIAN_ARTICLES and checkAnswer.
9. **ready:false stub** — Step 2 now explicitly documents ready:false behavior and clarifies LanguageEntry has no pricing field.

## Done-condition
- `grep -n "french_lifetime\|pricing.*lifetime\|lib/srs.ts" CONTRIBUTING_LANGUAGE.md` → zero hits ✓
- tsc=PASS · 707 tests pass · lint=0 errors ✓

## Debt entries logged: 0
## Carry-forward tasks generated: 0

---

# Stream W1C — Session 3 Completion (Task #027)
**Date:** 2026-06-27
**Stream:** W1C — extract checkAnswer + levenshtein to lib/answerCheck.ts
**Status:** COMPLETE
**Verification gate at close:** tsc=PASS (owned files) · 658 tests pass · lint=0 errors
**Pre-existing failures (off-limits):** 2 test files (Toggle.test.tsx, useExportImport.test.ts) — W1B files without implementations yet

## Tasks Completed — Session 3

### Task #027 — Extract checkAnswer + levenshtein to lib/answerCheck.ts ✓
- Created `lib/answerCheck.ts` with: `ITALIAN_ARTICLES`, `SPANISH_ARTICLES`, `levenshtein`, `stripArticle`, `checkAnswer` (all exported)
- Trimmed `lib/srs.ts` from 290 → 206 lines (under 250-line limit) — removed the 85-line answer-checking section
- Added backwards-compatible re-export in `lib/srs.ts`: `export { checkAnswer, levenshtein, stripArticle, ITALIAN_ARTICLES, SPANISH_ARTICLES } from "@/lib/answerCheck"`
- Updated `lib/language.ts`: import ITALIAN/SPANISH_ARTICLES from `@/lib/answerCheck`
- Updated `components/StudyCard.tsx`: split import — `checkAnswer` from `@/lib/answerCheck`, `autoRate + Grade` from `@/lib/srs`
- Created `tests/answerCheck.test.ts`: 18 tests pinning the module boundary (levenshtein × 4, stripArticle × 3, checkAnswer × 11)
- Test-first (SCTS Kaizen): test written before module existed, confirmed red, then green after creation

## Debt entries logged: 0
## Carry-forward tasks generated: 0

---

# Stream W1C — Session 2 Completion (Tasks #018 #019 #021)
**Date:** 2026-06-27
**Stream:** W1C — component tests + seam test
**Status:** ALL 3 TASKS COMPLETE
**Verification gate at close:** tsc=PASS · 624 tests pass (22 files) · lint=PASS

## Tasks Completed — Session 2

### Task #018 — components/StudyCard.test.tsx ✓
- 6 tests: renders without crashing, input accepts answers, correct→non-again grade after FLASH_MS, wrong×2→Continue→onRate("again"), prompt text visible, canonical answer shown in result phase.
- `vi.useFakeTimers()` controls FLASH_MS (1400ms) timer; `checkAnswer` mocked to control paths.

### Task #019 — EntitlementValidator.test.tsx (audit) + InterruptHandler.test.tsx ✓
- EntitlementValidator.test.tsx: all 4 required cases already covered — no changes made.
- InterruptHandler.test.tsx: 3 tests — no listener when isTauri=false; DnD guard prevents /study navigation; updateInterruptConfig called when interruptEnabled changes.
- `vi.hoisted()` used to expose `tauriState` + mocks to vi.mock factories; `@tauri-apps/plugin-store` mocked to prevent Tauri IPC calls from Zustand persist middleware.

### Task #021 — tests/seam_importRestore.test.ts ✓
- 6 tests crossing lib/importBackup.ts → store/srsStore.ts: parseBackup ok:true, setState without error, getDueCards returns due card and excludes non-due, no throw for unknown IDs, dueDate preserved through normalizeCardProgress, parseBackup rejects invalid backup.

## Infrastructure added (Session 2)
- `jsdom@^29.1.1` and `@testing-library/react@^16.3.2` installed as devDependencies.
- `// @vitest-environment jsdom` per-file override in StudyCard.test.tsx and InterruptHandler.test.tsx.

---

# Stream W1C — Session 1 Completion Summary
**Date:** 2026-06-26
**Stream:** W1C — entitlement / importBackup / settings
**Status:** ALL 9 TASKS COMPLETE
**Verification gate at close:** tsc=PASS (in owned files) · 358 tests pass · 2 pre-existing failures in Derek W1D files

---

## Tasks Completed

### Task #071 — Fix Rule 3 upward import in lib/importBackup.ts ✓
- Eliminated `@/store/migrations` import — `lib/licenseTypes.ts` extracted as shared lib location.
- KAIZEN test: `import-graph: lib/importBackup.ts does not import from @/store` (tests/importBackup.test.ts:232)

### Task #063 — Structural validation in parseBackup() before field access ✓
- `parseBackup()` validates `_version`, `srs` (type + null + array checks), `entitlement` before any field access.
- KAIZEN tests: rejects non-object payload, missing required fields, non-object srs (tests/importBackup.test.ts:43–59)

### Task #009 — Remove console.warn raw err in EntitlementValidator ✓
- `console.warn` uses `result.error` (string), not raw `err` object (components/EntitlementValidator.tsx:45)
- KAIZEN test: verifies `console.warn` called with string `"Subscription expired."`, not object (EntitlementValidator.test.tsx:200–219)

### Task #007 — Fix FileReader.onerror to read DOMException ✓
- **New fix this session:** Changed `reader.onerror = (e) =>` to read `(event.target as FileReader).error` (the DOMException) before logging. The previous structural tests had been added but the actual DOMException was not being read.
- KAIZEN test added: structural check that `(event.target as FileReader).error` is present in source (tests/importBackup.test.ts:232–237)

### Task #074 — Sanitize deactivateLicense raw error string ✓
- `deactivateLicense` returns `ERR_DEACTIVATE_DECLINED` constant (not `res.error`) on server rejection.
- Tests verify no raw LS error leaks to UI (entitlement.test.ts:511–535)

### Task #053 — Extract error strings to named constants ✓
- `ERR_ACTIVATE_NETWORK` and `ERR_DEACTIVATE_NETWORK` were extracted in prior session.
- **New constants added this session:** `ERR_ACTIVATION_FAILED`, `ERR_ACTIVATE_NO_INSTANCE`, `ERR_LICENSE_NOT_ACTIVE`, `ERR_DEACTIVATE_DECLINED` (lib/entitlement.ts:19–24)
- Updated all call sites in lib/entitlement.ts (5 sites)
- Updated tests/entitlement.test.ts to import constants instead of string literals (5 `.toBe()` assertions updated)

### Task #054 — EntitlementValidator render/mount test ✓
- 3 render-based tests in `describe("render-based mount wiring (Task #054)")` (EntitlementValidator.test.tsx:163–198)
- useEffect mocked to run synchronously; tests call `EntitlementValidator()` directly

### Task #055 — Narrow reset helper type in entitlement tests ✓
- `type EntitlementStateOnly = Pick<...>` excludes action methods (tests/entitlement.test.ts:30–34)
- `reset()` parameter narrowed to `Partial<EntitlementStateOnly>` — prevents passing store actions as state

### Task #070 — Mark ALL_KNOWN_PACKS as @deprecated ✓
- `/** @deprecated Use ALL_PACK_CODES from @/lib/langRegistry directly. */` on re-export (store/entitlementStore.ts:26)

---

## Files Modified This Session
| File | Changes |
|------|---------|
| `app/settings/page.tsx` | FileReader.onerror reads `(event.target as FileReader).error` |
| `lib/entitlement.ts` | +4 error string constants; 5 call sites updated |
| `tests/entitlement.test.ts` | Import 4 new constants; 5 test assertions use constants not literals |
| `tests/importBackup.test.ts` | +1 structural test: FileReader.onerror reads DOMException |

## Pre-existing failures (not caused by this stream, not in owned files)
- tests/langRegistry.test.ts: 2 failures (Derek W1D — placeholder LANG_CONFIG_MAP entries for fr/de/pt)
- store/srsStore.ts: 1 TypeScript error (Barry W1B — missing commitSession property)

## Test count
- Session start: 357 passing / 2 failing (pre-existing)
- Session end: 358 passing / 2 failing (pre-existing) — +1 new structural test (#007 DOMException)
