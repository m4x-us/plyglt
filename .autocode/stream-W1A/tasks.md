# Stream W1A Task State

### Task #015 | Delete dead test file — tests/grading.test.ts
**Severity:** 3 | **File(s):** `tests/grading.test.ts`
**DoD Tier:** 1
**Complexity: Direct**

`tests/grading.test.ts` is a strict subset of `tests/srs.test.ts` — every assertion it contains already exists in srs.test.ts. It adds zero coverage and creates maintenance drift (if `autoRate` behaviour changes, both files need updating).

**Changes required:**
1. Delete `tests/grading.test.ts`.
2. Confirm `tests/srs.test.ts` covers every test case that was in `grading.test.ts` — the 5 `autoRate` tests are already present.

**Done condition:** `ls tests/grading.test.ts` returns "No such file". `npm test` passes without it. Verification gate green.

---

### Task #016 | Fix vacuous assertion in language.test.ts
**Severity:** 4 | **File(s):** `tests/language.test.ts:196`
**DoD Tier:** 1
**Complexity: Direct**

Line 196 uses `toBeTruthy()` on a card label string. Any non-empty string passes `toBeTruthy()`, including `"undefined"` or `" "`. This is a vacuous assertion — it does not verify the label is meaningful.

**Changes required:**
1. `tests/language.test.ts:196` — replace `toBeTruthy()` with a specific assertion. For card labels, use `expect(label).toMatch(/\S/)` (non-whitespace) AND `expect(label).not.toBe("undefined")` AND `expect(label.length).toBeGreaterThan(2)` (labels must be at least 3 chars to be meaningful — "OK" would fail this correctly).

**Done condition:** `grep -n "toBeTruthy" tests/language.test.ts` returns zero hits. Verification gate green.

---

### Task #014 | Fix false-green poka-yoke test in language.test.ts
**Severity:** 7 | **File(s):** `tests/language.test.ts:206-211`
**DoD Tier:** 2
**Complexity:** ⚡ Direct — 2 files (tests/language.test.ts + lib/language.ts), no package boundary, test fix + stub

The poka-yoke guard at lines 206-211 asserts `cfg.code !== "it"` but `LANGUAGE_MAP` has `fr`, `de`, `pt` all pointing to `SPANISH` (which has `code: "es"`). The test passes not because the mapping is correct but because `"es" !== "it"` — false green. The test should assert `cfg.code === code` (the returned config's code must match the requested language code).

**Changes required:**
1. `tests/language.test.ts:210` — change:
   ```ts
   expect(cfg.code, ...).not.toBe("it");
   ```
   to:
   ```ts
   expect(cfg.code, `getLanguageConfig("${code}") returned wrong config — update LANGUAGE_MAP in lib/language.ts`).toBe(code);
   ```
2. This will immediately fail for `fr`, `de`, `pt` because their `LANGUAGE_MAP` entries point to `SPANISH` (code `"es"`). Fix `lib/language.ts:99-101` — for placeholder languages, create minimal stub configs with the correct `code` field, or use `ITALIAN` as a placeholder with the correct code overridden. The cleanest fix: create `PLACEHOLDER_LANG_CONFIG(code: string): LanguageConfig` factory that returns a config with the correct `code` field derived from the argument, reusing ITALIAN/SPANISH UI strings until real configs are authored.

**Test required:** The test itself is the fix — it must fail before the `lib/language.ts` fix and pass after.

**Done condition:** `npm test -- tests/language.test.ts` passes. `getLanguageConfig("fr").code === "fr"`. Verification gate green.

---
