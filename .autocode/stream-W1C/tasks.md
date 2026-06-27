# Stream W1C Task State

### Task #027 | Extract checkAnswer + levenshtein to lib/answerCheck.ts
**Severity:** 4 | **File(s):** `lib/srs.ts:218-266`
**DoD Tier:** 2
**Complexity:** 🔧 Full — "extract" keyword, 4 files (lib/srs.ts, lib/answerCheck.ts, lib/language.ts, components/StudyCard.tsx)

`checkAnswer` and `levenshtein` are answer-evaluation utilities that have grown in complexity (NFC normalization, diacritic tolerance from #010-#011, article stripping). They belong in their own focused module (`lib/answerCheck.ts`) per Rule 6 (Extract Ready — every module can become its own SaaS product). `lib/srs.ts` should only contain FSRS scheduling logic.

**Changes required:**
1. Create `lib/answerCheck.ts` — move `checkAnswer`, `levenshtein`, `stripArticle`, `ITALIAN_ARTICLES`, `SPANISH_ARTICLES` from `lib/srs.ts`. Keep exports from `lib/srs.ts` as re-exports for backwards compatibility (`export { checkAnswer, ITALIAN_ARTICLES, SPANISH_ARTICLES } from "@/lib/answerCheck"`).
2. Update all import sites of `checkAnswer`, `ITALIAN_ARTICLES`, `SPANISH_ARTICLES` to import from `@/lib/answerCheck`. Callers: `lib/language.ts:2`, `components/StudyCard.tsx` (wherever it calls checkAnswer).

**Test required:** Tests already exist in `tests/srs.test.ts` for `checkAnswer`. Add `tests/answerCheck.test.ts` that imports directly from `lib/answerCheck` to pin the module boundary.

**Done condition:** `lib/answerCheck.ts` exists. `lib/srs.ts` imports `checkAnswer` from `lib/answerCheck`. `wc -l lib/srs.ts` ≤ 250 (Rule 2 for services). Verification gate green.
