# Stream W21A Task State

### Task #467: Fix data-integrity: parseBackup's newer-app-version compatibility gate is bypassed by a truthy non-number _version

**File:** lib/importBackup.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** OPEN

**What:**
parseBackup's early guard (`!data._version`) only rejects falsy values; the newer-version rejection only fires `if (typeof data._version === "number" && data._version > CURRENT_BACKUP_VERSION)`. A truthy non-number `_version` (e.g. the string `"999"`) passes both guards untouched, completely bypassing the "reject backups written by a newer app" check this function exists to enforce. Confirmed by direct execution: `parseBackup({_version: "999", srs:{...}, entitlement:{...}})` returns `{ok:true,...}` instead of the intended rejection. A hand-edited or corrupted backup (or a genuinely newer app version that ever serializes _version as a string) defeats the entire compatibility gate. at lib/importBackup.ts:94.

**Acceptance Criteria:**
- [ ] A non-number (but truthy) _version value is rejected the same way an out-of-range number is, with the same or an equally clear error message
- [ ] A test supplies a string _version like "999" and asserts the backup is rejected, not silently accepted

**Source:** Cycle-7 audit finding F01 — severity 7 — convergence 1/8 (Agent N, verified via direct execution) — LIVE, shipped backup-restore path.

---

### Task #468: Fix error-handling: validatePack's card-ID-uniqueness loop throws uncaught instead of returning errors

**File:** scripts/validatePack.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** OPEN

**What:**
The duplicate-card-ID check (`for (const unit of (raw["units"] as Json[])) { for (const card of (unit["cards"] as Json[])) ... }`) casts without the same isArray() guard validateUnit already uses (line 118) before its own "cards must be an array" error. A unit with `cards: null` throws an uncaught TypeError ("... is not iterable") instead of returning the accumulated string[] of errors, breaking the function's own `(raw): string[]` contract and crashing the CI validator process (`npm run pack:validate:all`) on exactly the malformed input the validator exists to catch gracefully. Confirmed by direct execution. at scripts/validatePack.ts:181.

**Acceptance Criteria:**
- [ ] The duplicate-ID loop guards against a non-array cards field the same way validateUnit's own check does, and accumulates an error instead of throwing
- [ ] A test supplies a unit with cards:null (or any non-array) and asserts validatePack returns a normal error array, not an uncaught exception

**Source:** Cycle-7 audit finding F02 — severity 6 — convergence 1/8 (Agent N, verified via direct execution) — LIVE, this is the real CI pack-validation code path.

---
