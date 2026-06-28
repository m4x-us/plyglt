# Stream W1A Task State

### Task #049 | implementation | severity 6
**What:** Update `handleRate` in `app/study/page.tsx` to record introduction results and pass `getIntroductionDueCardIds` to `buildQueue`
**Why:** Without wiring the store actions into the study loop, introduction results are never persisted — the engine tracks nothing. After `rateCardAndSaveSession` (from #013), call `recordIntroductionResult(currentCard.id, wasCorrect, localDateStr())` IF the card is in the introduction phase (`introductions[currentCard.id] && !introductions[currentCard.id].graduated`). Pass `getIntroductionDueCardIds` to the `buildQueue` call in the `initialQueue` useMemo.
**Complexity:** 🔧 Full — "integrate" keyword, 1 file (app/study/page.tsx); re-classified from Direct
**Blocked by:** Task #048
**Blocks:** Task #050
**Test required (write first):** Add to `tests/seam_studyLoop.test.ts` (from #020): after rating a card that is in introduction phase, `useSRSStore.getState().introductions[cardId].totalEncounters === 1`.
**Done condition:** `grep -n "recordIntroductionResult" app/study/page.tsx` returns a hit. `grep -n "getIntroductionDueCardIds" app/study/page.tsx` returns a hit. Seam test passes. Verification gate green.
