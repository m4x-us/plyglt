# Stream W1D Task State

### Task #020 | Add seam test — pack load → buildQueue → rateCard → saveActiveSession
**Severity:** 8 | **File(s):** `tests/` (new file), spanning `lib/packLoader.ts`, `lib/queue.ts`, `store/srsStore.ts`
**DoD Tier:** 2
**Complexity:** 🔧 Full — 3+ files (spanning lib/packLoader.ts, lib/queue.ts, store/srsStore.ts)

Rule 13: cross-boundary data has at least one integration test without mocking intermediate layers. The most critical path — load pack → build queue → rate card → save session — has no seam test. A regression in any hand-off (e.g. wrong card ID format, queue building with stale state) would be invisible until a user hits it.

**Changes required:**
Create `tests/seam_studyLoop.test.ts`:
1. Load a real (non-mocked) pack subset: import 2-3 cards from `content/index.ts` directly.
2. Call `buildQueue(cards, getDueCards, getNewCards, false)` with a fresh store state — assert queue is non-empty.
3. Call `rateCardAndSaveSession(queue[0].id, "good", session)` on the store.
4. Assert `useSRSStore.getState().cards[queue[0].id].reps === 1`.
5. Assert `useSRSStore.getState().activeSession.position === 1`.
6. Assert both changes happened in the same store tick (no intermediate state where only one was updated) — verify by checking that between steps 2 and 4 there was only one `set()` call (use `vi.spyOn` on the store's `setState`).

**Done condition:** `tests/seam_studyLoop.test.ts` exists and passes. `npm test -- tests/seam_studyLoop.test.ts` green. Verification gate green.

**Status: COMPLETE — 2026-06-27**

---
