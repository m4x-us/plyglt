# Barry — Stream W24B — Wave 24 — 2026-07-28

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions:
— Barry | W24B | #488 #491

You are Barry, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

Both of your tasks touch store/entitlementCrossTabSync.ts — that's why they're one stream.
Do them in this order: #488 first (the migrate()-throws test coverage question is the
substantive gap; its outcome may affect what you write in the doc comment), then #491 (the
instanceof Promise fragility, an independent latent-gap fix in the same file).

## Your Tasks (run in this exact order)
1. /task #488 — Fix error-handling: entitlementCrossTabSync's Task #482 fix doesn't cover the real migrate()-throws failure path, only the synthetic getItem-throws case
2. /task #491 — Fix async: triggerRehydrate's `instanceof Promise` check misclassifies non-native thenables, contradicting the module's own stated generality

STATUS BOARD RULE — MANDATORY: After every completed /task, print your current status board:

Barry — W24B
[✓] #488 — migrate()-throws test coverage gap   ← done
[→] #491 — instanceof Promise fragility   ← starting now
[ ] ...

Then proceed to the next task.

## Files You Own (edit ONLY these)
store/entitlementCrossTabSync.ts
tests/entitlementCrossTabSync.test.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
lib/importBackup.ts
tests/importBackup.test.ts
scripts/validatePack.ts
tests/validatePack.test.ts

## Task Definitions

### Task #488: Fix error-handling: entitlementCrossTabSync's Task #482 fix doesn't cover the real migrate()-throws failure path, only the synthetic getItem-throws case

**File:** store/entitlementCrossTabSync.ts, tests/entitlementCrossTabSync.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Blocked by:** Nothing
**Priority:** P1

**What:**
Task #482's fix (and its own new documentation) proves the reject-branch logging is unreachable for every real production failure, because zustand's `hydrate()` terminal `.catch` never rethrows when `postRehydrationCallback` is undefined (verified against `node_modules/zustand/esm/middleware.mjs` v5.0.14). Two realistic failure sources funnel into this same swallowed catch: `storage.getItem()` throwing (tested by Task #482's new test) and `migrate()` throwing (NOT tested). The latter is not hypothetical — `store/migrations.ts` throws `Missing...migration to version X` errors, and all three stores (`entitlementStore.ts`, `srsStore.ts`, `settingsStore.ts`) register a `migrate` function per CLAUDE.md §4's documented convention. Task #482's new test exercises only the `getItem`-throws case on a synthetic probe store with no `migrate` option configured. Unlike the initial-mount hydration path, which has an explicit failsafe (`lib/storage.ts`'s `useIsHydrated`, `HYDRATION_FAILSAFE_MS` timeout, Tasks #406/#435), this direct `window.addEventListener("storage", ...)` path has no equivalent timeout or log — a cross-tab rehydrate that silently fails via a `migrate()` throw (e.g. triggered by stale/corrupted data written by another tab) leaves the tab's in-memory state stale forever with zero signal anywhere in the app. Rule 8 violation (a real, designed-to-exist error path is silently swallowed) and Rule 23c violation (the untested twin path shipped without being filed as tracked debt, only implicitly noted in a doc comment). This resolves a genuine disagreement between Agent K (who argued Task #482's root cause — an unverified assumption — was fully verified and pinned) and Agents B/W (who argued the same reasoning proves a second, untested, real failure path also funnels into the same swallow) in favor of B/W: Task #482's own acceptance criteria required verifying the fix "actually covers" any genuine rejection path, and the migrate()-throws path was never exercised. at store/entitlementCrossTabSync.ts:createCrossTabSync:48-69,94-117.

**Acceptance Criteria:**
- [ ] Add a test exercising the `migrate()`-throws scenario specifically (a `persist` config with a `migrate` function that throws, mirroring this app's real stores) and confirm whether `persist.rehydrate()` resolves or rejects in that case
- [ ] If it resolves (swallowing the migrate error, per the same zustand behavior documented for `getItem`), decide and implement: either surface this failure some other way (e.g. the store's own `migrate` function should catch-and-log internally before rethrowing, so the error is diagnosable even though the rehydrate promise itself never rejects), or explicitly document this as an additional accepted trade-off with the same rigor as the `getItem` case — not left as an implicit gap
- [ ] Update the module's doc comment so its "confirmed with a live regression test" claim is scoped to what is actually tested

**Source:** Cycle-10 audit finding F004 — severity 7 — Rule 8 + Rule 23c violation, ESCALATE.

**Note:** Tasks #489 and #490 (deferred, not yours this wave) both depend on what you decide here — #489 reconciles the module header's single-caller claim against the doc comment's reuse-justification, #490 narrows the "confirmed with a live regression test" overclaim. Whatever you write in the doc comment for #488's third acceptance criterion should make both of those follow-ups straightforward, not create more work for them.

---

### Task #491: Fix async: triggerRehydrate's `instanceof Promise` check misclassifies non-native thenables, contradicting the module's own stated generality

**File:** store/entitlementCrossTabSync.ts, tests/entitlementCrossTabSync.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Blocked by:** Nothing
**Priority:** P3

**What:**
`if (result instanceof Promise)` (line 99) misclassifies any non-native thenable as synchronous: it calls `done()` immediately and resets `rehydrateInFlight = false` while real async work is still in flight, silently breaking the dedup/queue guarantee this module exists to provide. This directly contradicts the doc comment's stated generality (`rehydrate` typed as `() => unknown`, described as "not tied to Zustand specifically," intended for future reuse with "a non-Zustand or differently-configured rehydrate function"). Not exercised by any current caller since zustand returns a native Promise — latent gap, not an active bug today. at store/entitlementCrossTabSync.ts:triggerRehydrate:99.

**Acceptance Criteria:**
- [ ] Either broaden the check to detect any thenable (e.g. `result && typeof (result as any).then === "function"`) so the module's stated generality is genuinely honored, or narrow the doc comment's generality claim to match what the code actually supports (native Promises only)
- [ ] If broadened: add a test with a custom non-native thenable proving the dedup/queue guarantee still holds

**Source:** Cycle-10 audit finding F007 — severity 4.

## When You Finish
Write your completion summary to .autocode/stream-W24B/completion.md, beginning with:

CLOSED: #488 #491
NOT_CLOSED: none

(or the appropriate variant). Then prose detail. Then tell Max: "Barry is done."

— Barry | W24B | #488 #491
