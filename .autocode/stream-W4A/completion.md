# Stream W4A — Wave 4 — Completion

**Agent:** Adam  
**Wave:** 4  
**Date:** 2026-07-07  
**Tasks:** #232 #231 #233 #228 #229 #230 #234 #240 #241 #242

---

## Status Board

| Task | Status | Notes |
|------|--------|-------|
| #232 | COMPLETE | `isCalendarValidDate` round-trip check added to migration v3; catches "2026-02-30" rollover |
| #231 | COMPLETE | `getDayOfPhase` now uses `isCalendarValidDate` (isNaN + round-trip); throws on "2026-13-45" and "2026-02-30" |
| #233 | COMPLETE | Null/non-object records now build a complete 11-field default instead of sparse `{ phaseStartDate }` |
| #228 | COMPLETE | `strandedAcrossDays?: boolean` added to `IntroductionRecord`; set on triple-wrong, cleared on correct; `canIntroduceNewCard` uses it |
| #229 | COMPLETE | `getNextCardType` call removed from `recordIntroductionResult`; `lastSeenType` doc comment updated; F03 test removed |
| #230 | COMPLETE | Superseded by #229 — mechanism removed; no separate code change |
| #234 | COMPLETE | `getDayOfPhase` throw wrapped in try/catch inside `getIntroductionDueCardIds`; corrupt records skip, valid cards still returned |
| #240 | COMPLETE | `DATE_RE` and `isCalendarValidDate` extracted to `lib/utils.ts`; single canonical definition; lib/introduction.ts and store/migrations.ts import from there |
| #241 | COMPLETE | `MAX_PHASE_DAY = 22` exported from `lib/introduction.ts`; used at object-key, clamp, and rescue-path sites |
| #242 | COMPLETE | `recordResult` correct-branch uses `shouldGraduate({ ...base, consecutiveCorrect })` instead of inline comparison |

---

## Files Changed

- `lib/utils.ts` — added `DATE_RE` export, `isCalendarValidDate` export
- `lib/introduction.ts` — full rewrite: imports shared `isCalendarValidDate`, adds `MAX_PHASE_DAY`, `getDayOfPhase` uses calendar validation, `recordResult` uses `shouldGraduate` and sets `strandedAcrossDays`, `getNextCardType` docstring updated
- `content/types.ts` — added `strandedAcrossDays?: boolean`, updated `lastSeenType` doc comment
- `store/migrations.ts` — imports `isCalendarValidDate` from `lib/utils`, removed local duplicate; null-record recovery builds complete default record
- `store/srsStore.ts` — removed `getNextCardType`/`CONSECUTIVE_WRONG_RESET`/`ALL_CARD_TYPES`/`CardType`; `recordIntroductionResult` no longer updates `lastSeenType`; `canIntroduceNewCard` uses `strandedAcrossDays`; `getIntroductionDueCardIds` has try/catch; `22` → `MAX_PHASE_DAY`
- `tests/srsStore.test.ts` — added imports for `migrateSrsStore`, `getDayOfPhase`; removed F03; replaced F10 with seam test; added tests for #232, #233, #231 calendar validation, #234 corrupt-record skip

---

## Verification Gate

- `npx tsc --noEmit` — 0 errors ✓
- `npm test` — 1016/1016 passing ✓  
- `npm run lint` — 0 errors (1 pre-existing warning in unrelated file) ✓
- `grep -rn "const DATE_RE" lib/ store/` — single match in lib/utils.ts ✓
- `grep -n "\b22\b" lib/introduction.ts store/srsStore.ts` — only the constant definition line ✓

---

## Key Design Decisions

**#228 — strandedAcrossDays with exactOptionalPropertyTypes:** Used conditional mutation of the fresh result object (`if (record.strandedAcrossDays === true) { result.strandedAcrossDays = false; }`) rather than `strandedAcrossDays: undefined` (blocked by `exactOptionalPropertyTypes: true`) or `strandedAcrossDays: false` (would add an `false` property to records that never had it, breaking off-limits `toEqual` tests). Approach: only write the field when clearing from `true`; when input has no `strandedAcrossDays`, output has no `strandedAcrossDays`. toEqual ignores absent vs absent. ✓

**#229 — variety-rule removal:** Removed only the dead srsStore wiring (`getNextCardType` call, `lastSeenType: nextType` write-back). `getNextCardType` and `lastSeenType` field kept in place — the function is tested in off-limits `tests/introduction_behavior.test.ts` and the field is referenced by the same file's `makeRecord`. Decision documented in `getNextCardType` JSDoc.

**#230 — superseded:** Closed as not-applicable; #229 removed the srsStore mechanism that made `getNextCardType`'s 2-of-5 bug observable.
