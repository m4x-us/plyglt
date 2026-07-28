# Stream W16D Task State

### Task #434: Fix error-handling: lib/constants.ts has zero try/catch around any localStorage call

**File:** lib/constants.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
getTargetLangCode, setTargetLangCode, getLangPair, and hasStoredLangPair (lib/constants.ts:15-60) all call window.localStorage directly with no try/catch anywhere in the file. If localStorage throws (private-browsing quota errors, disabled storage in a locked-down webview), the throw propagates uncaught into callers (app/page.tsx's mount effect, hooks/useExportImport.ts's handleExport/readFile) with no ErrorBoundary anywhere in the codebase, crashing the page instead of degrading the way lib/storage.ts's createPlatformStorage does for the Zustand stores. at lib/constants.ts:module:15.

**Acceptance Criteria:**
- [ ] All 4 functions wrap their localStorage calls in try/catch, degrading gracefully (logged, with a sane fallback) rather than throwing
- [ ] Test: a throwing localStorage does not crash any of the 4 functions

**Source:** Audit finding F061 — severity 6 — error-handling

---

### Task #435: Fix data-loss: useIsHydrated's failsafe timeout can silently overwrite live user state

**File:** lib/storage.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix — may require surfacing a distinct return value/signal
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
HYDRATION_FAILSAFE_MS (3000ms, lib/storage.ts:useIsHydrated:114-144) cannot distinguish "stuck forever" from "merely slow." If real hydration completes AFTER the failsafe already flipped hydrated to true and the app acted on default/partial state, Zustand persist's rehydrate later shallow-merges the newly-loaded persisted data via set(), silently overwriting any user state changes (card ratings, entitlement writes) made in the failsafe-to-real-hydration window. The function's name/doc promises "true once persist has finished reading," but its actual meaning is "storage read done OR we stopped waiting," with no way for callers to distinguish which. at lib/storage.ts:useIsHydrated:114.

**Acceptance Criteria:**
- [ ] useIsHydrated (or a sibling signal) distinguishes a genuine hydration completion from a failsafe timeout, so consumers can avoid acting on writes that a late real-hydration merge would clobber
- [ ] Test: a state change made during the failsafe-to-real-hydration window is not silently lost when real hydration eventually completes

**Source:** Audit finding F062 — severity 6 — data-loss

---
