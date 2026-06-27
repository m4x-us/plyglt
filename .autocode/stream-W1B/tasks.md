# Stream W1B Task State

### Task #017 | Add unit tests for lib/storage.ts
**Severity:** 6 | **File(s):** `lib/storage.ts` (no test file exists)
**DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 file, no package boundary, test-only creation

`createPlatformStorage` and `useIsHydrated` have zero tests. `createPlatformStorage` is the persistence foundation for every Zustand store — a regression here silently corrupts all user data.

**Changes required:**
Create `tests/storage.test.ts` with:
1. `createPlatformStorage` — in the web (non-Tauri) path, `setItem`/`getItem`/`removeItem` round-trip correctly through a mocked `localStorage`.
2. `createPlatformStorage` — `getItem` on a missing key returns `null` (not `undefined`).
3. `createPlatformStorage` — when `localStorage` throws (mocked to throw), `getItem` propagates the error rather than swallowing it.
4. `useIsHydrated` — renders `false` before hydration, then `true` after `onFinishHydration` fires (use `renderHook` from `@testing-library/react`).

**Done condition:** `tests/storage.test.ts` exists with ≥4 passing tests covering the above. Verification gate green.

---

### Task #076 | tests | severity 4
**What:** Add `lib/storage.ts` test coverage — no test file exists; 42.42% statement coverage
**Why:** `lib/storage.ts` has 7 importers and zero dedicated tests. QA agent found 42.42% statement coverage with uncovered paths at lines 54, 72-73, 99-107. Rule 5: every new behaviour has a test. This is existing behaviour with no tests. Note: Task #017 in this batch covers the same file — these tasks should be merged at execution time; the DoD is the union of both task specs.
**File:** `lib/storage.ts`
**Severity:** 4 | **DoD Tier:** 1
**Complexity:** ⚡ Direct — 1 file, no package boundary, test-only creation
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Low — test-only task.
**Test required (write first):** Create `tests/storage.test.ts` covering: (a) `getItem` returns `null` when key doesn't exist; (b) `setItem` + `getItem` round-trip; (c) `removeItem` clears the key; (d) SSR guard (`window` undefined) does not throw; (e) error path when `localStorage` throws.
**Done condition:** `npm test -- tests/storage.test.ts` passes. `grep -n "from.*storage" tests/storage.test.ts` returns a hit. Verification gate green.
**Owner:** QA Agent

---

### Task #022 | Add property-based FSRS invariant tests
**Severity:** 6 | **File(s):** `tests/srs.test.ts`
**DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 file, no package boundary, parameterized test addition

No property-based tests verify FSRS mathematical invariants. These catch edge cases (extreme inputs, adversarial grades) that unit tests with fixed inputs miss.

**Changes required:**
Add to `tests/srs.test.ts`:
1. **Difficulty invariant:** For any `CardProgress` and any `Grade`, `scheduleCard(prev, grade).difficulty` is always in `[1, 10]`. Test with: all four grades × states `new/learning/review/relearning` × difficulty values `1, 5, 10`.
2. **Stability lower bound:** `scheduleCard(prev, grade).stability >= 0.001` for all inputs.
3. **Stability upper bound:** `scheduleCard(prev, grade).stability <= 36500` for all inputs (guards #012).
4. **dueDate monotonicity:** For non-`"again"` grades in `review` state, `scheduleCard(prev, grade).dueDate > prev.dueDate`.
5. **Reps always increments:** `scheduleCard(prev, grade).reps === prev.reps + 1` for all inputs.
These can be parameterized tests using `it.each` — no property-testing library required.

**Done condition:** 5 parameterized invariant tests added and passing. Verification gate green.

---

### Task #023 | Add getNewCards prerequisite logic tests
**Severity:** 5 | **File(s):** `tests/srsStore.test.ts`
**DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 file, no package boundary, test augmentation

`getNewCards` in `store/srsStore.ts:126-133` has prerequisite logic (`prerequisitesMet` at line 80-83) that is completely untested. A bug here could surface cards whose prerequisites are not met (level gating failure).

**Changes required:**
Add to `tests/srsStore.test.ts`:
1. A card with no prerequisites is returned by `getNewCards`.
2. A card whose prerequisite card is in state `"new"` (not yet reviewed) is NOT returned.
3. A card whose prerequisite card is in state `"review"` IS returned.
4. `getNewCards` respects the `limit` parameter — never returns more than `limit` cards.
5. `getNewCards` returns cards sorted by tier (tier 1 before tier 2).

**Done condition:** 5 tests added and passing. Verification gate green.

---
