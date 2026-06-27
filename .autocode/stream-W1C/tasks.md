# Stream W1C Task State

### Task #018 | Add component test for StudyCard.tsx (Rule 14)
**Severity:** 6 | **File(s):** `components/StudyCard.tsx` (no co-located test)
**DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 file, no package boundary, test-only creation

Rule 14: every user-facing React component has a co-located `.test.tsx`. `StudyCard.tsx` has zero tests. It is the primary interactive component — a regression here breaks the core loop.

**Changes required:**
Create `components/StudyCard.test.tsx` with:
1. Renders without crashing given a `produce` card.
2. Text input accepts typed answers.
3. Submitting a correct answer calls `onRate` with a non-`"again"` grade.
4. Submitting a wrong answer calls `onRate` with `"again"` (after 3 attempts, or immediately if that is how the component works — check `StudyCard.tsx` impl).
5. The card shows the prompt text.
6. After a correct answer, the correct feedback string is visible.

**Done condition:** `components/StudyCard.test.tsx` exists. `npm test -- components/StudyCard.test.tsx` passes all 6 cases. Verification gate green.

---

### Task #019 | Add component tests for EntitlementValidator and InterruptHandler (Rule 14)
**Severity:** 5 | **File(s):** `components/EntitlementValidator.tsx`, `components/InterruptHandler.tsx`
**DoD Tier:** 2
**Complexity:** ⚡ Direct — 2 files, no package boundary, test-only creation

Both components have zero tests (Rule 14 violation).

**Changes required:**
Create `components/EntitlementValidator.test.tsx`:
1. Does not call `validateLicense` when `needsValidation()` returns false.
2. Calls `validateLicense` when `needsValidation()` returns true and `licenseKey`/`instanceId` are set.
3. Calls `markValidated` when validation succeeds.
4. Does NOT call `console.warn` on validation failure (regression guard for #009).

Create `components/InterruptHandler.test.tsx`:
1. Does not register the `interrupt:fire` listener when `isTauri` is false.
2. Does not navigate to `/study` when `isInDnd` is true.
3. Calls `updateInterruptConfig` when `interruptEnabled` changes.

**Done condition:** Both test files exist and all tests pass. Verification gate green.

---

### Task #021 | Add seam test — parseBackup → setState → getDueCards
**Severity:** 6 | **File(s):** `tests/` (new file), spanning `lib/importBackup.ts`, `store/srsStore.ts`
**DoD Tier:** 2
**Complexity:** ⚡ Direct — 2 files, no package boundary, seam test creation

No integration test covers the backup restore path. A corrupted `parseBackup` output that passes its own validation but produces bad store state (e.g. wrong `dueDate` types) would silently break `getDueCards`.

**Changes required:**
Create `tests/seam_importRestore.test.ts`:
1. Construct a minimal valid backup JSON with 2 card progress entries (one due, one not).
2. Call `parseBackup(json)` — assert `result.ok === true`.
3. Apply `useSRSStore.setState({ ...result.srs })`.
4. Call `getDueCards(mockCards)` where `mockCards` matches the card IDs from the backup.
5. Assert the due card is returned and the non-due card is not.
6. Assert `getDueCards` does not throw when given card IDs not present in the backup (graceful degradation).

**Done condition:** `tests/seam_importRestore.test.ts` exists and passes. Verification gate green.

---
