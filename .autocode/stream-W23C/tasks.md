# Stream W23C Task State

### Task #482: Fix error-handling: entitlementCrossTabSync's Task #474 fix logs a rejection branch that Zustand's real persist.rehydrate() can never actually trigger

**File:** store/entitlementCrossTabSync.ts, tests/entitlementCrossTabSync.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Task #474 added console.error logging to the rejection handler of `result.then(done, (err) => {...})`. But under this store's actual persist() configuration — no onRehydrateStorage callback is registered in store/entitlementStore.ts, store/srsStore.ts, or store/settingsStore.ts — Zustand's own hydrate() (verified by tracing node_modules/zustand/esm/middleware.mjs) terminates in a `.catch((e) => { postRehydrationCallback?.(void 0, e); })` that never rethrows or rejects when postRehydrationCallback is undefined. The promise persist.rehydrate() returns can therefore never reject in production — it always resolves. The new rejection branch and its regression test only exercise a path unreachable via the real Zustand dependency this module actually calls; the fix satisfies Rule 8 only against a mock, not against production. Not a security leak (the branch never runs), but the stated diagnosability goal isn't actually accomplished for real users. at store/entitlementCrossTabSync.ts:84.

**Acceptance Criteria:**
- [ ] Determine whether Zustand's persist.rehydrate() can ever genuinely reject under this app's configuration (check across all Zustand versions/configs in use, not just the current one) — if it truly cannot, document this explicitly in the module's header comment so the "async-reject" branch is understood as defensive-only, not a live diagnostic path
- [ ] If a genuine rejection path exists elsewhere (e.g. a future onRehydrateStorage callback, or a different persist config), verify the fix actually covers it; otherwise consider whether the test should mock a more faithful (non-rejecting) version of Zustand's real behavior instead of a synthetic always-controllable Promise

**Source:** Cycle-9 audit finding F009 — severity 6 — convergence 1/8 (Security Agent S, verified against actual Zustand source) — highest-confidence single-reviewer finding this cycle.

---
