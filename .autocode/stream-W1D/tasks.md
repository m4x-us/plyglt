# Stream W1D Task State

### Task #185 | security | severity 7
**What:** Guard `activateLicense` against an empty `instanceId`. The current guard `if (!res.instance)` at `lib/entitlement.ts:139` is falsy only for `null` and `undefined`. A Lemon Squeezy API response with `instance: { id: '' }` is truthy; the guard passes, and `instanceId: ''` is persisted to the entitlement store. Every subsequent `validateLicense(key, '')` and `deactivateLicense(key, '')` call sends an empty instance ID, producing API errors that surface to users as generic network failures with no indication of root cause.

Fix: change line 139 to `if (!res.instance?.id)`. This is a one-character change — the existing `console.error` and return statement stay unchanged.

Note: the corresponding test (`instance: { id: '' }` → ok:false) lives in Task #183. This task is the production code fix only.
**Why:** Users who activate on a degraded Lemon Squeezy response end up stuck — license appears active but every subsequent validation fails — with no recovery path other than re-entering their license key. Open as F011 across two consecutive audits with no task.
**File:** `lib/entitlement.ts`
**Severity:** 7 | **DoD Tier:** 1
**Complexity:** ⚡ Direct — 1 file, no package boundary, single-scope fix
**Blocked by:** Nothing | **Blocks:** #183 (the F010 test turns green once this fix is in place)
**Test required:** Covered by Task #183 (F010). Run the full test suite to confirm no regressions.
**Done when:** `grep "instance?.id" lib/entitlement.ts` has a hit at line 139. Verification gate green.
**Owner:** Security Agent

---

### Task #186 | security | severity 4
**What:** Wrap `LANG_CONFIG_MAP` in `Object.freeze()`. It is created via `Object.fromEntries()` in `lib/langRegistry.ts` but not frozen; any importer can write `LANG_CONFIG_MAP['it'] = maliciousConfig` without a TypeError, silently replacing a security-relevant language configuration. The existing frozen arrays (`ALL_PACK_CODES`, `READY_PACK_CODES`, `FREE_PACK_CODES`) all have a comment explaining why they are frozen — the asymmetric treatment of `LANG_CONFIG_MAP` is unexplained.

Fix: `Object.freeze(LANG_CONFIG_MAP)` at point of declaration.

Note: `MAX_APPEARANCES_BY_PHASE_DAY` in `lib/introduction.ts` was originally in this task's scope too (same underlying finding — a mutable exported scheduling table) but is dropped here to avoid two streams editing the same line: Task #179 (F07) already freezes it as part of its own scope.
**Why:** Known-open finding across two consecutive Batch 1 audits. Latent rather than immediately exploitable (no live callers mutate this today), but the correct time to close a latent mutable-export gap is before the code ships to users, not after.
**File:** `lib/langRegistry.ts`
**Severity:** 4 | **DoD Tier:** 1
**Complexity:** ⚡ Direct — 1 file, no package boundary, single-scope fix
**Blocked by:** Nothing | **Blocks:** Nothing
**Test required:** TypeScript compiler enforces freeze at compile time for typed callers; no new test needed beyond verifying tsc passes.
**Done when:** `grep "Object.freeze(LANG_CONFIG_MAP)" lib/langRegistry.ts` returns a hit. `npx tsc --noEmit` clean. Verification gate green.
**Owner:** Security Agent
