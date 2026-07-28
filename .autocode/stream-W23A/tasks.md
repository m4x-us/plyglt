# Stream W23A Task State

### Task #479: Fix data-integrity: parseBackup's _version handling uses isNaN instead of isFinite, accepting Infinity/hex/fractional strings as plausible versions — in both the new AND a pre-existing branch

**File:** lib/importBackup.ts, tests/importBackup.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** OPEN

**What:**
The new string-`_version` branch (Task #477) uses `!isNaN(parsedVersion)` instead of `isFinite(parsedVersion)` — this file already documents elsewhere why that distinction matters ("typeof NaN === 'number' is true — isFinite() is required to reject NaN and Infinity", used correctly in normalizeCardProgress). `Number("Infinity")` = `Infinity`, `isNaN(Infinity)` is false, so `_version:"Infinity"` is accepted into the newer-version branch and produces the nonsensical message "backup vInfinity, app supports v2. Please update plyglt." Also confirmed live: hex strings ("0x10"→16) and fractional strings ("2.5", "999.5") are silently accepted as valid versions. CRITICAL: this same defect ALSO exists in the untouched sibling NUMERIC branch (shipped 2 waves ago in Task #467, not touched by this wave) — a raw `_version:1e400` in hand-edited JSON parses to `Infinity` (typeof number) via the same unguarded path. The defect class exists twice in one function, unaddressed both times. Reachable live via hooks/useExportImport.ts's user-facing backup-restore file picker. at lib/importBackup.ts:108.

**Acceptance Criteria:**
- [ ] Both the string-parsing branch and the numeric branch use `isFinite()` (not just truthy/isNaN checks) to reject Infinity/-Infinity in both string and number form
- [ ] Tests cover _version as "Infinity", a raw JSON Infinity-producing literal (e.g. 1e400), hex strings, and fractional strings — all should get the generic rejection message, not the "newer version" message

**Source:** Cycle-9 audit finding F001 — severity 6 — convergence 6/8 (Agents N, B, A, K, Red R, W) — Rule 23 violation, LIVE, reachable via the real backup-restore path.

---

### Task #481: Fix requirements: parseBackup's string-_version branch has no acceptance path, rejecting a numeric string equal to the current version that its numeric equivalent would accept

**File:** lib/importBackup.ts, tests/importBackup.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
The string-`_version` branch added for Task #477 has no acceptance path at all: after the newer-version check fails, it unconditionally returns the generic "missing required fields" message. This means `_version:"2"` (string, exactly CURRENT_BACKUP_VERSION) is REJECTED, while the numerically identical `_version:2` (number) is ACCEPTED via the sibling branch. Two framings to weigh: (1) a real functional regression/inconsistency — Task #477 only fixed the genuinely-newer sub-case and left the equal-or-lower sub-case asymmetric with its numeric equivalent; (2) an intentional, tested design choice resting on the assumption that real backups never serialize _version as a string at all — true only for the CURRENT export path (lib/exportBackup.ts always writes a number), not structurally enforced against any future export path. at lib/importBackup.ts:106.

**Acceptance Criteria:**
- [ ] Decide and implement: either the string path accepts a valid, non-newer numeric-string version symmetrically with the numeric path, OR the design tradeoff (string _version is never valid) is explicitly enforced/documented as intentional with the assumption's fragility noted
- [ ] A test exists for a numeric string strictly LOWER than CURRENT_BACKUP_VERSION (not just the boundary-equal case), since the current test only covers "=" despite its name implying "≤"

**Source:** Cycle-9 audit finding F004 — severity 5 — convergence 3/8 (Agents K, Red R, W — with differing severity framings) — requirements, LIVE.

---

### Task #483: Fix code-quality: parseBackup's generic error message string is now triplicated, and the "newer version" template is duplicated across 2 branches

**File:** lib/importBackup.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The literal "Invalid backup file — missing required fields." now appears 3 times verbatim in parseBackup (Task #477 added a 3rd occurrence). AGENTS.md's Poka-Yoke stop-the-line rule explicitly bans "any hardcoded string that belongs in a named constant." Separately, the "This backup was created by a newer version...update plyglt" message template is now independently hand-constructed in two places (string branch, number branch) with different interpolated variables — a future wording change requires remembering to edit both. at lib/importBackup.ts:104.

**Acceptance Criteria:**
- [ ] Both message strings are extracted to named constants or a small helper function, used by all call sites (3 for the generic message, 2 for the newer-version message)
- [ ] No behavior change; existing tests pass unmodified

**Source:** Cycle-9 audit finding F006 — severity 4 — convergence 2/8 (Agent A, Red Agent R) — Poka-Yoke violation, LIVE.

---
