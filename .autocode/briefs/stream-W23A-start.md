# Adam — Stream W23A — Wave 23 — 2026-07-28

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions:
— Adam | W23A | #479 #481 #483

You are Adam, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

All three of your tasks touch parseBackup's `_version` handling in lib/importBackup.ts —
that's why they're one stream. Do them in this order: #479 first (the isFinite fix is
foundational and affects both branches), then #481 (the acceptance-path design decision,
which builds on #479's now-correct number validation), then #483 last (extracting message
constants from the by-then-stable logic, so you're not refactoring code you're still
actively changing).

## Your Tasks (run in this exact order)
1. /task #479 — Fix data-integrity: parseBackup's _version handling uses isNaN instead of isFinite, accepting Infinity/hex/fractional strings as plausible versions
2. /task #481 — Fix requirements: parseBackup's string-_version branch has no acceptance path
3. /task #483 — Fix code-quality: parseBackup's generic error message string is now triplicated

STATUS BOARD RULE — MANDATORY: After every completed /task, print your current status board:

Adam — W23A
[✓] #479 — isNaN vs isFinite in both _version branches   ← done
[→] #481 — string-_version acceptance-path decision   ← starting now
[ ] #483 — message string deduplication

Then proceed to the next task.

## Files You Own (edit ONLY these)
lib/importBackup.ts
tests/importBackup.test.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
scripts/validatePack.ts
tests/validatePack.test.ts
store/entitlementCrossTabSync.ts
tests/entitlementCrossTabSync.test.ts

## Task Definitions

### Task #479: Fix data-integrity: parseBackup's _version handling uses isNaN instead of isFinite, accepting Infinity/hex/fractional strings as plausible versions

**File:** lib/importBackup.ts, tests/importBackup.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Blocked by:** Nothing
**Priority:** P1

**What:**
The new string-`_version` branch (Task #477) uses `!isNaN(parsedVersion)` instead of `isFinite(parsedVersion)` — this file already documents elsewhere why that distinction matters ("typeof NaN === 'number' is true — isFinite() is required to reject NaN and Infinity", used correctly in normalizeCardProgress). `Number("Infinity")` = `Infinity`, `isNaN(Infinity)` is false, so `_version:"Infinity"` is accepted into the newer-version branch and produces the nonsensical message "backup vInfinity, app supports v2. Please update plyglt." Also confirmed live: hex strings ("0x10"→16) and fractional strings ("2.5", "999.5") are silently accepted as valid versions. CRITICAL: this same defect ALSO exists in the untouched sibling NUMERIC branch (shipped 2 waves ago in Task #467) — a raw `_version:1e400` in hand-edited JSON parses to `Infinity` (typeof number) via the same unguarded path.

**Acceptance Criteria:**
- [ ] Both the string-parsing branch and the numeric branch use `isFinite()` (not just truthy/isNaN checks) to reject Infinity/-Infinity in both string and number form
- [ ] Tests cover _version as "Infinity", a raw JSON Infinity-producing literal (e.g. 1e400), hex strings, and fractional strings — all should get the generic rejection message, not the "newer version" message

**Source:** Cycle-9 audit finding F001 — severity 6 — convergence 6/8 (highest convergence recorded in this batch's history) — Rule 23 violation, LIVE.

---

### Task #481: Fix requirements: parseBackup's string-_version branch has no acceptance path, rejecting a numeric string equal to the current version that its numeric equivalent would accept

**File:** lib/importBackup.ts, tests/importBackup.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Blocked by:** Nothing
**Priority:** P2

**What:**
The string-`_version` branch has no acceptance path at all: after the newer-version check fails, it unconditionally returns the generic "missing required fields" message. `_version:"2"` (string, exactly CURRENT_BACKUP_VERSION) is REJECTED, while the numerically identical `_version:2` (number) is ACCEPTED. Two framings from different reviewers to weigh: (1) a real functional regression — the equal-or-lower sub-case is asymmetric with its numeric equivalent; (2) an intentional, tested design choice resting on the assumption that real backups never serialize _version as a string at all — true only for the current export path, not structurally enforced.

**Acceptance Criteria:**
- [ ] Decide and implement: either the string path accepts a valid, non-newer numeric-string version symmetrically with the numeric path, OR the design tradeoff is explicitly documented as intentional with the assumption's fragility noted
- [ ] A test exists for a numeric string strictly LOWER than CURRENT_BACKUP_VERSION (not just the boundary-equal case)

**Source:** Cycle-9 audit finding F004 — severity 5 — convergence 3/8 (differing severity framings) — requirements, LIVE.

---

### Task #483: Fix code-quality: parseBackup's generic error message string is now triplicated, and the "newer version" template is duplicated across 2 branches

**File:** lib/importBackup.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Blocked by:** Nothing
**Priority:** P3

**What:**
"Invalid backup file — missing required fields." now appears 3 times verbatim in parseBackup. AGENTS.md's Poka-Yoke rule bans hardcoded strings that belong in a named constant. Separately, the "newer version...update plyglt" message template is independently hand-constructed in two places with different interpolated variables.

**Acceptance Criteria:**
- [ ] Both message strings are extracted to named constants or a small helper function, used by all call sites
- [ ] No behavior change; existing tests pass unmodified

**Source:** Cycle-9 audit finding F006 — severity 4 — Poka-Yoke violation, LIVE.

## When You Finish
Write your completion summary to .autocode/stream-W23A/completion.md, beginning with:

CLOSED: #479 #481 #483
NOT_CLOSED: none

(or the appropriate variant). Then prose detail. Then tell Max: "Adam is done."

— Adam | W23A | #479 #481 #483
