# Stream W19A Task State

### Task #445: Fix resilience: no pack/manifest fetch call has a timeout, so a single hung connection permanently poisons the in-flight cache

**File:** lib/basePackLoader.ts, lib/specialtyPackLoader.ts, lib/packLoader.ts
**Complexity:** 🔧 Full — 3 files, same fix pattern applied at each fetch call site
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
None of the pack/manifest fetch() calls (lib/basePackLoader.ts's load path, lib/specialtyPackLoader.ts's _doLoad, lib/packLoader.ts's fetchManifest) have an AbortController or timeout. Each is guarded by an in-flight promise cache that only releases its map entry on settlement. A single hung TCP connection leaves that promise permanently pending — every concurrent and future caller for that language/manifest piggybacks on the dead promise for the rest of the process's life, with zero recovery path short of restarting the app. This affects the live base-pack load path already serving real users today. at lib/basePackLoader.ts:loadBasePackFromStorageOrNetwork:183.

**Acceptance Criteria:**
- [ ] All 3 fetch call sites use an AbortController with a reasonable timeout (e.g. 15-30s)
- [ ] A timed-out fetch releases its in-flight cache entry and returns a typed failure result, not a permanently-pending promise
- [ ] Test: a fetch that never resolves is timed out and a subsequent call for the same language/manifest succeeds normally afterward

**Source:** Audit finding F023 — severity 6 — resilience/live-path

---

### Task #447: Fix rule-violation: lib/specialtyPackLoader.ts is now over the 400-line service cap

**File:** lib/specialtyPackLoader.ts
**Complexity:** 🔧 Full — extract a cohesive slice, following the same pattern used for store/entitlementStore.ts → store/entitlementAddOns.ts
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
lib/specialtyPackLoader.ts is 430 lines, 30 over the Rule 1 400-line services cap — a fresh, open violation arising in the same wave family that just fixed store/entitlementStore.ts's identical cap violation via a deliberate split (Task #412). at lib/specialtyPackLoader.ts:module:1.

**Acceptance Criteria:**
- [ ] File split so no resulting file exceeds 400 lines, following the entitlementStore.ts → entitlementAddOns.ts extraction pattern
- [ ] All existing tests pass unchanged
- [ ] CLAUDE.md updated with the new module's role

**Source:** Audit finding F007 — severity 5 — rule-violation/file-size

---

### Task #443: Fix validator-completeness: hasValidUnitsArray never validates card.prerequisites' shape, a live crash path

**File:** lib/packTypes.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
hasValidUnitsArray validates unitCount/cardCount, units array shape, and per-unit/per-card fields including Array.isArray checks on unit.prerequisiteUnits and card.tags — but never examines card.prerequisites at all. card.prerequisites is read by lib/srs.ts:206-207 (card.prerequisites.every(...)), reachable from both store/srsStore.ts's getNewCards (the live FSRS new-card queue, used by the shipped Italian pack today) and the introduction engine. A malformed pack with a non-array-but-truthy prerequisites value would throw a TypeError in a live, currently-shipping code path — not gated behind specialty packs being unready, since this validates the base Italian pack too. Practical likelihood is tempered by packs coming from a sha256-verified, self-controlled CDN, but the validator's own stated purpose is unmet for this field. at lib/packTypes.ts:hasValidUnitsArray:79.

**Acceptance Criteria:**
- [ ] hasValidUnitsArray validates that card.prerequisites, when present, is an array of strings
- [ ] Test: a pack with a non-array-but-truthy card.prerequisites value is rejected by the validator, not left to crash lib/srs.ts downstream

**Source:** Audit finding F021 — severity 7 — validator-completeness/live-path

---
