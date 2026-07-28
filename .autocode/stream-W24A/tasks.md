# Stream W24A Task State

### Task #485: Fix edge-case: parseBackup's Task #481 "symmetric acceptance" fix is asymmetric — string "0" is accepted, numeric 0 is rejected

**File:** lib/importBackup.ts, tests/importBackup.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** OPEN

**What:**
Task #481's symmetric-acceptance fix in parseBackup (lines ~103-142) is not actually symmetric. Execution-verified by Agent W via npx tsx: `_version: "0"` (string) is ACCEPTED (regex matches, Number=0, isFinite, not>2, falls through to ok:true) while `_version: 0` (number) is REJECTED (`!data._version` is true for the falsy value 0). Conversely `_version: "-1"` (string) is REJECTED (the digit regex `/^\d+$/` doesn't match a minus sign) while `_version: -1` (number) is ACCEPTED (no lower-bound check in the numeric branch at all). The Task #481 comment's own claim — "a valid, non-newer numeric-looking string... must be accepted identically [to its numeric equivalent]" — is false for the input 0. Neither case is covered by any existing test. Live path, reachable via the real user-facing backup-restore file picker (hooks/useExportImport.ts). Rule 23 violation: this recreates the exact defect class (cycle-9's F001, isNaN/isFinite branch divergence) inside the very task meant to close it, one input value away. at lib/importBackup.ts:parseBackup:103-142.

**Acceptance Criteria:**
- [ ] The string and numeric `_version` branches agree on every input — in particular, both accept or both reject `0` identically, and both accept or both reject negative integers identically (recommend: reject `_version <= 0` in both branches explicitly, rather than relying on JS truthiness/regex quirks to imply a floor)
- [ ] Tests cover `_version: 0`, `_version: "0"`, `_version: -1`, `_version: "-1"` and assert both serializations of the same nominal value produce the SAME `ok` result

**Source:** Cycle-10 audit finding F001 — severity 7 — convergence 6/8 (Agents A, B, N, W, Red R via direct reasoning/execution; Security Agent S assessed present but non-security) — the strongest convergence recorded in this batch's 10-cycle history — Rule 23 violation, LIVE, ESCALATE.

---
