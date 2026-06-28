# Stream W1C Task State
Exec order: #033 (solo stream, expedited per owner)

### Task #033 | Update CONTRIBUTING_LANGUAGE.md — NFC, diacritic tolerance, close threshold, card ID format, Batch 3 issues
**Severity:** 5 | **File(s):** `CONTRIBUTING_LANGUAGE.md`
**DoD Tier:** 4
**Complexity:** ⚡ Direct — 1 file, no package boundary, documentation-only changes
**⚡ FIRST in Batch 4 (expedited per owner 2026-06-27)**

`CONTRIBUTING_LANGUAGE.md` has 9 outstanding issues:

**Original scope (#010, #011 changes — already shipped):**
1. **NFC normalization behaviour:** all card text normalized to NFC on export (`scripts/exportPack.ts`). Authors write in composed form; tooling handles normalization.
2. **Diacritic tolerance:** `diacriticTolerant: true` means accent-only diff is `"close"` not `"wrong"`. Do NOT add duplicate answers — engine handles it.
3. **"close" Levenshtein threshold:** `"close"` only when `a.length > 4 AND distance === 1`. Shorter words are wrong-only.
4. **Card ID format:** Italian cards have no `{lang}-` prefix. Document both formats; note non-Italian cards should use full `{lang}-{level}u{unit:02d}-t{tier}-{seq:03d}`.

**New issues found /meet 2026-06-27:**
5. **Step 2 TypeScript compile error:** Example code includes `pricing: { lifetime: "$9.99" }` — `LanguageEntry` has no `pricing` field. Remove.
6. **Step 5 `french_lifetime` checkout key:** References a `lifetime` checkout type forbidden in `lib/entitlement.ts:118`. Remove; use a subscription key example.
7. **French as worked example:** `fr` was removed from `langRegistry.ts` 2026-06-27. Replace `fr` throughout with generic `{lang}` placeholder.
8. **Step 1 wrong file:** References `lib/srs.ts` for `ITALIAN_ARTICLES`, `checkAnswer` — these live in `lib/answerCheck.ts` after Task #027. Correct the file reference.
9. **lib/langRegistry.ts stub pattern:** Note that `ready: false` keeps a new language out of production until `public/packs/{lang}.json` exists.

**Done condition:** All 9 items addressed. Step 2 TypeScript example compiles without error. `grep -n "french_lifetime\|pricing.*lifetime\|lib/srs.ts" CONTRIBUTING_LANGUAGE.md` returns zero hits. Verification gate green.
