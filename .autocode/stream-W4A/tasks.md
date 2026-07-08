# Stream W4A Task State

### Task #232: Fix data-loss: migration v3's isNaN date guard misses day-of-month rollover

**File:** store/migrations.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P2

**What:**
The v3 migration's date guard (store/migrations.ts:71-90, added by Task #184 specifically to reject calendar-invalid dates) does not catch day-of-month rollover: `"2026-02-30"` passes both `DATE_RE` and `!isNaN(new Date(...).getTime())` because JS's `Date` silently normalizes it to a valid timestamp (March 2nd), so the calendar-invalid string is preserved as-is into the migrated record instead of falling back to today. The guard's own comment overclaims "rejects calendar-invalid strings" as a general class when it only covers month-overflow (e.g. month 13). Converged independently by Agents K, Red R, V, confirmed via `node` by the orchestrating CTO.

**Acceptance Criteria:**
- [ ] Strengthen the date guard to also reject day-of-month rollover — e.g. re-format the parsed `Date` back to a `YYYY-MM-DD` string and compare it to the original input string; a mismatch means the input was calendar-invalid even though `getTime()` didn't return NaN
- [ ] Add a test asserting a v2 record with `phaseStartDate: "2026-02-30"` falls back to today's date after migration, not a silently-rolled-forward date
- [ ] Correct the guard's comment to accurately describe what it now covers

**Done when:** A migration test with `phaseStartDate: "2026-02-30"` asserts the migrated record's `phaseStartDate` equals the fallback (today), not `"2026-02-30"` or a rolled-forward value. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 6 — data-loss — converged independently by Agents K, Red R, V.

---

### Task #231: Fix requirements: getDayOfPhase's date validation misses calendar-invalid-but-shape-valid dates

**File:** lib/introduction.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** Architecture Agent
**Blocked by:** Nothing (run after #232 in this stream)
**Priority:** P1

**What:**
`getDayOfPhase` (lib/introduction.ts:51-62) validates only string shape via `DATE_RE = /^\d{4}-\d{2}-\d{2}$/`, not calendar validity. A shape-valid, calendar-invalid string like `"2026-13-45"` passes the guard; `new Date("2026-13-45").getTime()` is `NaN`, so the function silently returns `NaN` instead of throwing — directly contradicting its own docstring ("Throws on malformed input... NaN propagation would cause silent card disappearance"). This is the exact failure mode Task #179 was built to eliminate, reintroduced one validation layer down. 5 of 8 auditors converged on this (S, W, K, Red R, V), each independently verifying via `node`.

**Acceptance Criteria:**
- [ ] Add an `isNaN(new Date(...).getTime())` check to `getDayOfPhase` itself (matching what `store/migrations.ts`'s v3 migration already does at the persistence boundary), throwing the same `[ERR-INTRO-DATE]` error on failure
- [ ] Add a test asserting `getDayOfPhase("2026-13-45", "2026-07-01")` throws, not returns NaN
- [ ] Update the function's docstring only if its claim still doesn't fully hold after the fix (verify against Task #232's day-of-month rollover finding too)

**Done when:** `getDayOfPhase("2026-13-45", "2026-07-01")` throws `[ERR-INTRO-DATE]` instead of returning NaN, verified by a new test. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 7 — requirements — converged independently by Agents S, W, K, Red R, V plus the orchestrating CTO's own node verification.

---

### Task #233: Fix data-loss: migration's null-record recovery produces an incomplete IntroductionRecord

**File:** store/migrations.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P2

**What:**
The v3 migration's null-record recovery path (store/migrations.ts:67-91, added by Task #184 to prevent a full-store-reset TypeError) produces `{ ...record, phaseStartDate }` where `record` is `{}` for a null/corrupt entry — only `phaseStartDate` is populated; the other 10 required `IntroductionRecord` fields are missing. The next `recordResult` call computes `record.totalEncounters + 1` and `record.consecutiveCorrect + 1` as `undefined + 1 = NaN`, permanently corrupting those counters — since `NaN >= GRADUATION_THRESHOLD` is always false, the card can never graduate again. A "recovery" path that itself introduces silent, permanent data corruption on the record it recovers. Found by Agent A, confirmed via code trace by the orchestrating CTO.

**Acceptance Criteria:**
- [ ] Build a complete default `IntroductionRecord` (all 11 fields, matching `introduceCard`'s initialization defaults) when a corrupt/null entry is recovered, not just `phaseStartDate`
- [ ] Add a test asserting that after migrating a `null` introduction record and then calling `recordResult` on it, `totalEncounters` and `consecutiveCorrect` are real numbers, not `NaN`
- [ ] Verify the recovered record can still graduate normally after 15 consecutive correct answers

**Done when:** A test migrates a null introduction record, calls `recordResult` on the migrated output, and asserts `totalEncounters` and `consecutiveCorrect` are `1` (not `NaN`). Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 6 — data-loss — found by Agent A, confirmed by the orchestrating CTO's own code trace.

---

### Task #228: Fix requirements: canIntroduceNewCard's cross-day wrong-streak pause is dead code

**File:** store/srsStore.ts, lib/introduction.ts, tests/srsStore.test.ts
**Complexity:** 🔧 Full — architectural fix, requires a new persisted signal
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P1

**What:**
`canIntroduceNewCard` (store/srsStore.ts:272) gates on `r.consecutiveWrongToday >= CONSECUTIVE_WRONG_RESET && r.lastSeenDate !== today` to implement BRAND.md's "Wrong across multiple days → New card introductions pause until this one stabilizes." This is Task #180's own F10 acceptance criterion. It is dead code: `recordResult` (lib/introduction.ts:120-127) always resets `consecutiveWrongToday` to 0 in the exact same write that would ever push it to the threshold — no writer in the codebase can persist a value >= 3. The only test for this (`tests/srsStore.test.ts` "F10") injects the unreachable state directly via `setState`, bypassing the real write path entirely. 7 of 8 independent audit agents converged on this finding.

**Acceptance Criteria:**
- [ ] Introduce a signal that survives the same-day reset — e.g. a `strandedAcrossDays: boolean` set once when a card resets to Day 1 and only cleared once the card records a correct answer on a later day, or redefine the trigger around comparing `phaseStartDate` resets across distinct calendar days
- [ ] Replace the F10 unit test with a seam test (matching `tests/seam_introduction.test.ts`'s pattern) that drives the cross-day-pause condition through `introduceCard`/`recordIntroductionResult` end-to-end, not via direct `setState` injection
- [ ] Verify the fix actually blocks `canIntroduceNewCard` when a real multi-day-wrong sequence is played through the store API

**Done when:** A new seam test drives a card wrong across 2+ real calendar-day boundaries through `recordIntroductionResult` and asserts `canIntroduceNewCard` returns `false` as a result — without directly setting `consecutiveWrongToday` via `setState`. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 9 — requirements — converged independently by Agents A, B, N, W, K, Red R, V.

---

### Task #229: Fix requirements: the "variety rule" (Task #180) has zero effect on what the user is shown

**File:** store/srsStore.ts, lib/introduction.ts, app/study/page.tsx, content/types.ts
**Complexity:** 🔧 Full — requires either a content-model change or removing the dead mechanism
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P1

**What:**
BRAND.md requires "each encounter uses a different retrieval angle" during the intensive introduction phase. Task #180 added `getNextCardType`/`lastSeenType` machinery to implement this, but it is fully inert: `app/study/page.tsx:147` calls `recordIntroductionResult(currentCard.id, g !== "again", localDateStr())` — it never passes the actually-displayed card's type. `recordIntroductionResult` (store/srsStore.ts:246-247) computes `getNextCardType(record.lastSeenType, ALL_CARD_TYPES)` and writes the result back into `lastSeenType`, but nothing anywhere in the codebase reads `IntroductionRecord.lastSeenType` to select what's actually shown — `StudyCard.tsx` renders strictly from the content pack's fixed, immutable `card.type`. There is no "sibling card" concept in the content model to even vary the presented format for a given word. 3 independent auditors (A, B, W) confirmed this via full-repo grep of `lastSeenType`.

**Acceptance Criteria:**
- [ ] Decide the actual mechanism: either (a) content packs need sibling cards per word/type so the queue can select an alternate-type card for the same word on each introduction encounter, or (b) if varying the retrieval angle is out of scope for now, remove the dead `lastSeenType`/`getNextCardType` wiring and its tests rather than leaving inert code that looks functional
- [ ] If implementing: add a seam test that drives two consecutive introduction encounters for the same card through the real queue-building path and asserts the actually-displayed card type differs
- [ ] Update content/types.ts's `lastSeenType` doc comment to be accurate about what it does today

**Done when:** Either a real end-to-end seam test proves the displayed card type varies across encounters, or the dead mechanism is removed with an explicit documented decision. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 9 — requirements — converged independently by Agents A, B, W plus the orchestrating CTO's own full-repo grep.

---

### Task #230: Fix code-quality: getNextCardType can only ever produce 2 of 5 CardTypes

**File:** lib/introduction.ts
**Complexity:** ⚡ Direct — 1 file, algorithm fix
**Owner:** Architecture Agent
**Blocked by:** Task #229 (fix depends on whether the mechanism is kept or removed)
**Priority:** P1

**What:**
`getNextCardType` (lib/introduction.ts:140-146) filters only the single `lastSeenType` out of the candidate pool and takes `pool[0]`. Given the fixed-order `ALL_CARD_TYPES = ["recognize","produce","conjugate","fill_blank","passage_cloze"]`, this means the function can only ever oscillate between `"recognize"` and `"produce"` — empirically confirmed via 10 sequential calls producing only 2 distinct outputs. `conjugate`, `fill_blank`, and `passage_cloze` are structurally unreachable no matter how many times the function is called. This defeats BRAND.md's stated premise ("varied retrieval across encounters produces durable memory") independent of the wiring gap in Task #229.

**Acceptance Criteria:**
- [ ] If Task #229 keeps the mechanism: rewrite the selection algorithm to genuinely rotate/vary across all N available types (e.g. round-robin through a shuffled or rotating order, or track more than just the single last-seen type)
- [ ] Add a test that calls the function N times in sequence and asserts all 5 CardTypes appear across the sequence (not just 2)
- [ ] If Task #229 removes the mechanism: this task is superseded — close as not-applicable with a cross-reference

**Done when:** A test drives `getNextCardType` through 10+ sequential calls and asserts at least 4 of the 5 CardTypes appear in the output sequence. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 8 — code-quality — confirmed empirically by the orchestrating CTO and independently by Agent W.

---

### Task #234: Fix error-handling: getDayOfPhase's throw is uncaught inside getIntroductionDueCardIds's filter loop

**File:** store/srsStore.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** Architecture Agent
**Blocked by:** Task #231 (getDayOfPhase's throw conditions are changing)
**Priority:** P2

**What:**
`getIntroductionDueCardIds` (store/srsStore.ts:250-264) calls `getDayOfPhase` inside a `.filter()` over ALL introduction records with no per-record try/catch anywhere in the call chain, and the app has zero `ErrorBoundary`/`componentDidCatch` components. One corrupted record now aborts due-card computation for every card, not just the offending one — a larger blast radius than the silent single-card disappearance the throw-on-invalid-input design was meant to replace. Found independently by Agents S and K.

**Acceptance Criteria:**
- [ ] Wrap the `getDayOfPhase` call inside the filter callback in a try/catch that logs a ref ID and excludes only that one record from the due-card set, rather than letting the exception propagate and abort the whole computation
- [ ] Add a test with one corrupt record and one valid record in `state.introductions`, asserting the valid record's card ID is still returned

**Done when:** A test with a mix of one corrupt and one valid introduction record asserts `getIntroductionDueCardIds` returns the valid record's card without throwing. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 5 — error-handling — found independently by Agents S and K.

---

### Task #240: Fix code-quality: DATE_RE regex duplicated across two files

**File:** lib/introduction.ts, store/migrations.ts
**Complexity:** ⚡ Direct — 2 files, extract to shared module
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P3

**What:**
`const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;` is independently defined in both lib/introduction.ts:9 and store/migrations.ts:60 — the exact duplicate-constant failure class this team already hit once this batch (`CONSECUTIVE_WRONG_RESET`, fixed in Batch 18 Wave 1). AGENTS.md explicitly bans "any parallel list/array that should be derived from a single source of truth." Found independently by Agents B and Red R.

**Acceptance Criteria:**
- [ ] Export `DATE_RE` once from a shared module (e.g. lib/utils.ts, already imported by both files) and import it in both places

**Done when:** `grep -rn "DATE_RE = " lib/ store/` returns exactly one definition. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 4 — code-quality — converged independently by Agents B and Red R.

---

### Task #241: Fix code-quality: phase-day boundary magic number 22 repeated in 3 places

**File:** lib/introduction.ts, store/srsStore.ts
**Complexity:** ⚡ Direct — 2 files
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P3

**What:**
The phase-day graduation boundary `22` is a bare literal repeated in three places with no shared named constant: `MAX_APPEARANCES_BY_PHASE_DAY[22] = 0` and `getDayOfPhase`'s `Math.min(diffDays + 1, 22)` clamp (both lib/introduction.ts), and the day-22+ rescue-path check in store/srsStore.ts:257. Found by Agent B.

**Acceptance Criteria:**
- [ ] Extract a named constant (e.g. `MAX_PHASE_DAY = 22`) in lib/introduction.ts, export it, and use it at all three call sites

**Done when:** `grep -rn "\b22\b" lib/introduction.ts store/srsStore.ts` shows no remaining bare `22` literal tied to the phase-day boundary. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 4 — code-quality — found by Agent B.

---

### Task #242: Fix code-quality: shouldGraduate() exported but never called; duplicated inline

**File:** lib/introduction.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P3

**What:**
`shouldGraduate()` (lib/introduction.ts:88-91) is exported but never called from production code — only from tests. `recordResult` (line 116) re-implements the identical check inline (`graduated: consecutiveCorrect >= GRADUATION_THRESHOLD`) instead of calling `shouldGraduate(record)`. Two independent expressions of the same rule. Found by Agent B.

**Acceptance Criteria:**
- [ ] Change `recordResult` to call `shouldGraduate({ ...record, consecutiveCorrect })` instead of re-implementing the comparison inline

**Done when:** `recordResult`'s graduation check calls `shouldGraduate` rather than duplicating its comparison. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 4 — code-quality — found by Agent B.
