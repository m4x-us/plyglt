# Charles — Stream W22C — Wave 22 — 2026-07-28

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions:
— Charles | W22C | #478 #476

You are Charles, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

Both your tasks touch tests/validatePack.test.ts — that's why they're one stream. Do #478
first (it adds a new test for the id-guard fix), then #476 (it replaces two existing tests)
— this way you're not editing the same regions of the file in a conflicting order.

## Your Tasks (run in this exact order)
1. /task #478 — Fix code-quality: validatePack's dedup loop uses an unchecked card id cast, producing garbled "Duplicate card IDs: " output for malformed cards
2. /task #476 — Fix test-quality: 2 of validatePack.test.ts's new malformed-shape regression tests use non-discriminating string fixtures

STATUS BOARD RULE — MANDATORY: After every completed /task, print your current status board:

Charles — W22C
[✓] #478 — validatePack dedup-loop unchecked id cast   ← done
[→] #476 — validatePack.test.ts non-discriminating string fixtures   ← starting now
[ ] (none)

## Files You Own (edit ONLY these)
scripts/validatePack.ts
tests/validatePack.test.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
store/entitlementCrossTabSync.ts
tests/entitlementCrossTabSync.test.ts
tests/fetchWithTimeout.test.ts
lib/importBackup.ts
tests/importBackup.test.ts

## Task Definitions

### Task #478: Fix code-quality: validatePack's dedup loop uses an unchecked card id cast, producing garbled "Duplicate card IDs: " output for malformed cards

**File:** scripts/validatePack.ts, tests/validatePack.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Blocked by:** Nothing
**Priority:** P3

**What:**
`const id = card["id"] as string;` (in the duplicate-card-ID loop added by Task #468) is unguarded. Two cards both missing/with non-string id collide as the same dedup key and produce a garbled `"Duplicate card IDs: "` (blank after the colon) — confirmed via direct execution against a crafted pack. Not a crash and no reporting is lost (validateCard's own check already reports the missing-id error elsewhere), but the output is confusing CI noise.

**Acceptance Criteria:**
- [ ] The dedup loop skips (or otherwise safely handles) a card whose id is missing or non-string, rather than using it as a dedup key
- [ ] A test supplies two cards both missing/with non-string id and asserts no garbled "Duplicate card IDs:" line is produced

**Source:** Cycle-8 audit finding C8-F05 — severity 4 — highest convergence this cycle (4/8 reviewers, 2 execution-verified), LIVE.

---

### Task #476: Fix test-quality: 2 of validatePack.test.ts's new malformed-shape regression tests use non-discriminating string fixtures

**File:** tests/validatePack.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Blocked by:** Nothing
**Priority:** P1

**What:**
Two of the six new Task #468 regression tests use a JS string as their "non-array" fixture (`cards: "not-an-array"`, `units: "not-an-array"`). Strings are iterable via `for...of` (yielding characters) and never throw, so neither test exercises the crash the isArray guards exist to prevent. Confirmed by direct mutation testing: removing `isArray(unit["cards"])` at scripts/validatePack.ts:191 AND removing `isArray(raw["units"])` at line 189 leaves all 20 tests in the file green either way. Only the `cards: null` and `units: [null]` fixtures in the same suite are genuinely discriminating.

**Acceptance Criteria:**
- [ ] The two string-fixture tests are replaced with genuinely non-array, non-null values that actually trigger the guard's throw path when the guard is removed — e.g. a number (`cards: 42`) or a plain object (`units: {}`) both fail `isArray()` and are NOT iterable via `for...of` without throwing, unlike a string
- [ ] Deletion Test: temporarily remove each isArray guard, confirm the updated tests now fail, then restore

**Source:** Cycle-8 audit finding C8-F03 — severity 5 — mutation-tested (Agent K), Rule 16/18 violation, LIVE.

## When You Finish
Write your completion summary to .autocode/stream-W22C/completion.md, beginning with:

CLOSED: #478 #476
NOT_CLOSED: none

(or the appropriate variant). Then prose detail. Then tell Max: "Charles is done."

— Charles | W22C | #478 #476
