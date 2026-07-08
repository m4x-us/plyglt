# Stream W4D Task State

### Task #243: Fix tests: study_loop.test.ts never asserts masteryPct

**File:** tests/study_loop.test.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P3

**What:**
"getStats correctly counts due, learning, and mastered across a mixed unit" (tests/study_loop.test.ts:86-109) checks 4 of 5 `getStats` return fields; `masteryPct` (drives `MASTERY_GATE`, a BRAND.md-critical unlock threshold) is never asserted. Found by Agent K.

**Acceptance Criteria:**
- [ ] Add an assertion on the exact expected `masteryPct` value for the test's mixed-unit fixture

**Done when:** The test asserts a specific `masteryPct` value, not just the other 4 fields. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 4 — tests — found by Agent K.

---

### Task #244: Fix tests: importBackup normalizeCardProgress fallback coverage incomplete

**File:** tests/importBackup.test.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P3

**What:**
`normalizeCardProgress` fallback coverage (tests/importBackup.test.ts:106-141) forces only 2 of 7 `CardProgress` fallback branches (`stability`, `lapses`); `difficulty`, `retrievability`, `dueDate`, and `reps` fallback paths (lib/importBackup.ts:52-56) are untested. Found by Agent K.

**Acceptance Criteria:**
- [ ] Add a test case per remaining fallback branch (`difficulty`, `retrievability`, `dueDate`, `reps`) with an invalid input value and an exact expected fallback assertion

**Done when:** All 7 `CardProgress` fallback branches have a dedicated test case with an exact expected value. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 4 — tests — found by Agent K.

---

### Task #245: Fix code-quality: AGENTS.md's Stop-the-Line list omits .toBeGreaterThan(0)

**File:** AGENTS.md
**Complexity:** ⚡ Direct — 1 file, 1 line
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P3

**What:**
AGENTS.md's Verification Gate grep (line ~39) bans 4 assertion patterns including `.toBeGreaterThan(0)`, but the adjacent Stop-the-Line Violations bullet list (line ~84) only mentions 3, omitting `.toBeGreaterThan(0)` — a parallel-list violation introduced by Task #227 itself, directly contradicting the rule stated one line above it in the same document ("Any parallel list/array that should be derived from a single source of truth"). Converged independently by Agents W and K.

**Acceptance Criteria:**
- [ ] Add `.toBeGreaterThan(0)` to the Stop-the-Line Violations bullet so it matches the Verification Gate grep pattern exactly

**Done when:** AGENTS.md's Stop-the-Line Violations bullet and Verification Gate grep pattern list the same 4 banned assertion patterns. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 4 — code-quality — converged independently by Agents W and K.
