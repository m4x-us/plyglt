# Stream W2B Task State

### Task #012 | Fix stability clamping — add upper bound in scheduleCard
**Severity:** 7 | **File(s):** `lib/srs.ts:177`
**DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 file, no package boundary, arithmetic clamp

`scheduleCard()` at line 177 clamps stability with `Math.max(0.1, S)` — a lower bound only. Without an upper bound, extreme FSRS inputs (very high stability values after many correct reviews) can produce stability values above 36500 days (100 years), causing `nextInterval()` to return astronomically large integers that overflow date arithmetic.

**Changes required:**
1. `lib/srs.ts:177` — change:
   ```ts
   stability: Math.max(0.1, S),
   ```
   to:
   ```ts
   stability: Math.max(0.001, Math.min(36500, S)),
   ```
   Note: lower bound also tightened from 0.1 to 0.001 to match FSRS spec (0.1 day = 2.4 hours is too coarse for same-session relearning cards).
2. `lib/srs.ts:54-58` — `nextInterval()` currently has no upper bound. Add `Math.min(36500, ...)` wrapper around the final interval value before the `Math.round`.

**Test required (write first):**
- `tests/srs.test.ts` — add:
  - After scheduling a card with impossibly high stability (e.g. inject `stability: 999999`), `scheduleCard(card, "easy").stability` is `≤ 36500`.
  - `nextInterval(999999)` returns `≤ 36500`.
  - `scheduleCard(card, "again").stability` is `≥ 0.001`.

**Done condition:** Tests above pass. `grep -n "Math.max(0.1" lib/srs.ts` returns zero hits. Verification gate green.

**Status: REOPENED — 2026-06-26**

---

### Task #010 | Fix NFC normalization — change NFD+strip to NFC in checkAnswer
**Severity:** 7 | **File(s):** `lib/srs.ts:225-229`
**DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 file, no package boundary, targeted normalization fix

The `normalize()` closure inside `checkAnswer` (lines 225-229) uses `.normalize("NFD").replace(/[̀-ͯ]/g, "")` — NFD decomposition followed by diacritic stripping. This is the wrong transformation for exact matching: it causes "caffè" typed correctly to strip its accent and match "caffe", accepting imprecise input as correct. Correct behaviour: use `.normalize("NFC")` to canonicalize Unicode without stripping diacritics. Diacritic-tolerant matching (for when the user omits accents) is a separate, additive feature gated by `diacriticTolerant` (added in #011).

**Changes required:**
1. `lib/srs.ts:225-229` — in the `normalize` closure, change `.normalize("NFD").replace(/[̀-ͯ]/g, "")` to `.normalize("NFC")`. Remove the diacritic-stripping regex entirely from `normalize`.
2. `lib/srs.ts:218-251` — add `diacriticTolerant?: boolean` to the `options` parameter type. Add a separate `normalizeStripped(s: string)` helper (private to the function scope) that applies NFC first, then strips diacritics — used only when `diacriticTolerant` is true.
3. Update the matching loop (lines 238-250): if `diacriticTolerant`, also compare `normalizeStripped(t)` against `normalizeStripped(a)` etc. A stripped match should return `"close"` not `"correct"` (missing accent = close, not exact).

**Test required (write first):**
- `tests/srs.test.ts` — add:
  - `checkAnswer("caffè", ["caffè"])` returns `"correct"` (NFC exact match).
  - `checkAnswer("caffe", ["caffè"])` returns `"wrong"` by default (no diacriticTolerant).
  - `checkAnswer("caffe", ["caffè"], { diacriticTolerant: true })` returns `"close"`.
  - `checkAnswer("caffè", ["caffè"], { diacriticTolerant: true })` returns `"correct"` (exact still preferred).

**Done condition:** Tests above pass. `grep -n "NFD" lib/srs.ts` returns zero hits. Verification gate green.

**Status: REOPENED — 2026-06-26**

---
