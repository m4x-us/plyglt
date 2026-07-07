---
status: done
agent: derek
stream: W1D
wave: 1
---

# Derek — Stream W1D — Wave 1 — 2026-07-06

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Derek | W1D | #185 #186

You are Derek, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #185  — Guard activateLicense against an empty instanceId
2. /task #186  — Freeze LANG_CONFIG_MAP

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Derek — W1D
[✓] #185 — Guard activateLicense against an empty instanceId   ← done
[→] #186 — Freeze LANG_CONFIG_MAP   ← starting now

Then proceed to the next task. This lets Max glance at any window and know
exactly where you are.

## Files You Own (edit ONLY these)
lib/entitlement.ts
lib/langRegistry.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
lib/introduction.ts
tests/introduction.test.ts
store/srsStore.ts
tests/srsStore.test.ts
store/migrations.ts
tests/migrations.test.ts

## Task Definitions

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

### Task #186 | security | severity 4
**What:** Wrap `LANG_CONFIG_MAP` in `Object.freeze()`. It is created via `Object.fromEntries()` in `lib/langRegistry.ts` but not frozen; any importer can write `LANG_CONFIG_MAP['it'] = maliciousConfig` without a TypeError, silently replacing a security-relevant language configuration. The existing frozen arrays (`ALL_PACK_CODES`, `READY_PACK_CODES`, `FREE_PACK_CODES`) all have a comment explaining why they are frozen — the asymmetric treatment of `LANG_CONFIG_MAP` is unexplained.

Fix: `Object.freeze(LANG_CONFIG_MAP)` at point of declaration.

Note: `MAX_APPEARANCES_BY_PHASE_DAY` in `lib/introduction.ts` was originally in this task's scope too (same underlying finding — a mutable exported scheduling table) but is dropped here to avoid two streams editing the same line: Task #179 (running in stream W1A, a different window) already freezes it as part of its own scope (F07). Do NOT touch lib/introduction.ts — it is off-limits for this stream.
**Why:** Known-open finding across two consecutive Batch 1 audits. Latent rather than immediately exploitable (no live callers mutate this today), but the correct time to close a latent mutable-export gap is before the code ships to users, not after.
**File:** `lib/langRegistry.ts`
**Severity:** 4 | **DoD Tier:** 1
**Complexity:** ⚡ Direct — 1 file, no package boundary, single-scope fix
**Blocked by:** Nothing | **Blocks:** Nothing
**Test required:** TypeScript compiler enforces freeze at compile time for typed callers; no new test needed beyond verifying tsc passes.
**Done when:** `grep "Object.freeze(LANG_CONFIG_MAP)" lib/langRegistry.ts` returns a hit. `npx tsc --noEmit` clean. Verification gate green.
**Owner:** Security Agent

## Agent Memories (Security Agent — relevant excerpt)

## Trust Boundaries
1. Lemon Squeezy API response (via Tauri IPC) → `lib/entitlement.ts` — `raw as LsActivateBody` structural cast only; field-presence checks guard happy path but do not reject unexpected types.

## Resolved Findings (do not re-report)
- License key format/length validation — FIXED (Task #098)
- Auto-download without consent — FIXED (Task #096, checkForUpdates() now returns availability without auto-installing)

## Intentional Design (do not raise as findings)
- Client-only entitlement — honor-system, no server-side verification. Decision 2026-06-24.
- No webhook endpoint — manual key activation by design.
- Interrupt engine ungated (free users can enable) — owner decision 2026-06-29.
- Spanish pack (es.json) hidden by ready:false — intentional; content not ready.

(F011 on activateLicense's empty-instance-id guard has been open across two consecutive Batch 1 audits with no task until now — this is that task.)

## When You Finish
Write your completion summary to .autocode/stream-W1D/completion.md:
  Tasks closed: [list task numbers that reached COMPLETE status]
  Tasks NOT completed: [list task number + done-when condition that failed]
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]

Then tell Max in this window: "Derek is done." (or describe what's incomplete).

— Derek | W1D | #185 #186
