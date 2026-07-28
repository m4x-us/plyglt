# Stream W22C Task State

### Task #478: Fix code-quality: validatePack's dedup loop uses an unchecked card id cast, producing garbled "Duplicate card IDs: " output for malformed cards

**File:** scripts/validatePack.ts, tests/validatePack.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
`const id = card["id"] as string;` (in the duplicate-card-ID loop added by Task #468) is unguarded. Two cards both missing/with non-string id collide as the same dedup key and produce a garbled `"Duplicate card IDs: "` (blank after the colon) — confirmed via direct execution against a crafted pack. Not a crash and no reporting is lost (validateCard's own check already reports the missing-id error elsewhere), but the output is confusing CI noise. The highest-convergence finding of cycle 8 — 4 of 8 reviewers independently found it, two via direct execution. at scripts/validatePack.ts:194.

**Acceptance Criteria:**
- [ ] The dedup loop skips (or otherwise safely handles) a card whose id is missing or non-string, rather than using it as a dedup key
- [ ] A test supplies two cards both missing/with non-string id and asserts no garbled "Duplicate card IDs:" line is produced

**Source:** Cycle-8 audit finding C8-F05 — severity 4 — convergence 4/8 (Agents A, B, W, Red R — highest convergence this cycle, 2 execution-verified) — code-quality, LIVE.

---

### Task #476: Fix test-quality: 2 of validatePack.test.ts's new malformed-shape regression tests use non-discriminating string fixtures

**File:** tests/validatePack.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** OPEN

**What:**
Two of the six new Task #468 regression tests use a JS string as their "non-array" fixture (`cards: "not-an-array"`, `units: "not-an-array"`). Strings are iterable via `for...of` (yielding characters) and never throw, so neither test exercises the crash the isArray guards exist to prevent. Confirmed by direct mutation testing: removing `isArray(unit["cards"])` at scripts/validatePack.ts:191 AND removing `isArray(raw["units"])` at line 189 leaves all 20 tests in the file green either way. Only the `cards: null` and `units: [null]` fixtures in the same suite are genuinely discriminating. Same defect class as cycle 7's F06 (a pseudocode test), recurring inside the very suite that fixed F02/#468. at tests/validatePack.test.ts:163.

**Acceptance Criteria:**
- [ ] The two string-fixture tests are replaced with genuinely non-array, non-null, non-iterable-without-throwing values (e.g. a number or a plain object) that actually trigger the guard's throw path when the guard is removed
- [ ] Deletion Test: temporarily removing each isArray guard now fails its corresponding test, then restore

**Source:** Cycle-8 audit finding C8-F03 — severity 5 — convergence 3/8 (Agent K, mutation-tested; Agent V; Red Agent R, implicit) — Rule 16/18 violation, LIVE.

---
