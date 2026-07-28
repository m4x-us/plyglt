# Adam — Stream W21A — Wave 21 — 2026-07-28

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions:
— Adam | W21A | #467 #468

You are Adam, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

These are the two genuinely LIVE, execution-verified bugs from cycle 7 — both found by an
auditor who actually ran the code against crafted inputs, not just read it. Consider doing
the same for your own fix: after writing it, actually run a small repro to confirm the bug
is gone, not just that the code looks right.

## Your Tasks (run in this exact order)
1. /task #467 — Fix data-integrity: parseBackup's newer-app-version compatibility gate is bypassed by a truthy non-number _version
2. /task #468 — Fix error-handling: validatePack's card-ID-uniqueness loop throws uncaught instead of returning errors

STATUS BOARD RULE — MANDATORY: After every completed /task, print your current status board:

Adam — W21A
[✓] #467 — parseBackup _version type-confusion bypass   ← done
[→] #468 — validatePack uncaught crash on malformed cards   ← starting now
[ ] (none)

## Files You Own (edit ONLY these)
lib/importBackup.ts
tests/importBackup.test.ts (add your new regression test here)
scripts/validatePack.ts
tests/validatePack.test.ts (add your new regression test here)

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
tests/entitlementCrossTabSync.test.ts
lib/basePackLoader.ts
tests/generationGuard.test.ts
tests/featureFlags.test.ts
tests/fetchWithTimeout.test.ts
vitest.config.ts

## Task Definitions

### Task #467: Fix data-integrity: parseBackup's newer-app-version compatibility gate is bypassed by a truthy non-number _version

**File:** lib/importBackup.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Blocked by:** Nothing
**Priority:** P1

**What:**
`parseBackup`'s early guard (`!data._version`) only rejects falsy values; the newer-version rejection only fires `if (typeof data._version === "number" && data._version > CURRENT_BACKUP_VERSION)`. A truthy non-number `_version` (e.g. the string `"999"`) passes both guards untouched, completely bypassing the "reject backups written by a newer app" check this function exists to enforce. Confirmed by direct execution: `parseBackup({_version: "999", srs:{...}, entitlement:{...}})` returns `{ok:true,...}` instead of the intended rejection.

**Acceptance Criteria:**
- [ ] A non-number (but truthy) _version value is rejected the same way an out-of-range number is, with the same or an equally clear error message
- [ ] A test supplies a string _version like "999" and asserts the backup is rejected, not silently accepted

**Source:** Cycle-7 audit finding F01 — severity 7 — LIVE, shipped backup-restore path.

---

### Task #468: Fix error-handling: validatePack's card-ID-uniqueness loop throws uncaught instead of returning errors

**File:** scripts/validatePack.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Blocked by:** Nothing
**Priority:** P1

**What:**
The duplicate-card-ID check (`for (const unit of (raw["units"] as Json[])) { for (const card of (unit["cards"] as Json[])) ... }`) casts without the same `isArray()` guard `validateUnit` already uses (line 118) before its own "cards must be an array" error. A unit with `cards: null` throws an uncaught TypeError ("... is not iterable") instead of returning the accumulated `string[]` of errors, breaking the function's own `(raw): string[]` contract and crashing the CI validator process (`npm run pack:validate:all`) on exactly the malformed input the validator exists to catch gracefully.

**Acceptance Criteria:**
- [ ] The duplicate-ID loop guards against a non-array cards field the same way validateUnit's own check does, and accumulates an error instead of throwing
- [ ] A test supplies a unit with cards:null (or any non-array) and asserts validatePack returns a normal error array, not an uncaught exception

**Source:** Cycle-7 audit finding F02 — severity 6 — LIVE, this is the real CI pack-validation code path.

## When You Finish
Write your completion summary to .autocode/stream-W21A/completion.md. The file
MUST begin with exactly these two lines, in this exact format, before any other content:

CLOSED: #467 #468
NOT_CLOSED: #[NUM] — [one-line reason]

(If both closed: `NOT_CLOSED: none`. If neither closed: `CLOSED: none`.)

After those two lines, write whatever prose detail is useful:
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]

Then tell Max in this window: "Adam is done." (or describe what's incomplete).

— Adam | W21A | #467 #468
