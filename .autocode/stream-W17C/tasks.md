# Stream W17C Task State

### Task #413: Fix tests: specialtyPackLoader's fresh-download hash-mismatch branch has no direct test

**File:** tests/specialtyPackLoader.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
lib/specialtyPackLoader.ts lines 257, 272, 318, 359 are uncovered; line 272 (the fresh-download hash-mismatch branch itself) is untested, distinct from the cached-copy hash-mismatch test that does exist. Not gate-blocking (project coverage clears thresholds) but a checksum-mismatch branch is exactly the kind of security-relevant path expected to have direct coverage. at lib/specialtyPackLoader.ts:_doLoad:272.

**Acceptance Criteria:**
- [ ] A test forces the fresh-download sha256 to mismatch and asserts the checksum_mismatch result
- [ ] Lines 257, 318, 359 covered or explicitly justified as unreachable

**Source:** Audit finding F010 — severity 4 — tests

---

### Task #427: Fix code-quality: parseFlag defaults to enabled, inverting the safe-off default for an unfinished feature

**File:** lib/featureFlags.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
parseFlag (lib/featureFlags.ts:18-21) defaults to TRUE unless the env var is explicitly "false"/"0"/"off"/"no". For a flag whose stated purpose is to be "the ONE place" gating an unfinished, dormant feature (specialty packs), this inverts the safe default — omitting the env var anywhere ships the feature live. Currently masked only by SPECIALTY_PACKS's single entry being ready:false. at lib/featureFlags.ts:parseFlag:18.

**Acceptance Criteria:**
- [ ] The specialty-packs feature flag defaults to off/false when unset, not on
- [ ] Test: an unset env var yields the flag disabled
- [ ] Confirm no other consumer of parseFlag relies on the current default-true behavior before changing it globally (may need a per-flag default parameter instead of a global default change)

**Source:** Audit finding F028 — severity 5 — code-quality

---
